import {App, Modal, Notice, setIcon, Setting} from "obsidian";
import WebDAVSyncPlugin from "../main";
import {canConnectWithSettings} from "settings";
import {Actions, actionToDescriptiveString, Content, SyncDir } from "./sync";
import {DryRunInfo, SyncImpl} from "./sync_impl";

export interface RemoteFileResult {
  content: Content | null;
  error: string | null;
};

export class SyncModal extends Modal {
  plugin: WebDAVSyncPlugin;
  dryRunInfoContainer: HTMLDivElement;
  syncImpl: SyncImpl;

  constructor(app: App, plugin: WebDAVSyncPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;

    this.syncImpl = new SyncImpl(
      this.plugin,
      this.setError,
      this.showTaskGraph.bind(this),
      this.close.bind(this),
      false,
      false
    )

    contentEl.empty();
    contentEl.createEl("h1", {
      text: "WebDAV sync controls",
      attr: {
        id: "webdav-sync-modal-header"
      }
    });
    
    if (!canConnectWithSettings(this.plugin.settings)) {
      contentEl.createEl("h2", {
        text: "No vault configured"
      });
      contentEl.createEl("p", {
        text: "You have not configured the sync connection settings. Please set a server, then try again"
      });
      return
    }
    new Setting(contentEl)
      .setName("Dry run")
      .setDesc("If set, the plugin will only tell you what it would've done, but not actually do it. "
        + "Meaning tell you which files it would change, but not actually do the changes. Useful "
        + "for debugging, or just making sure you trust the plugin"
      )
      .addToggle(toggle => 
        toggle
          .setValue(this.syncImpl.dryRun)
          .onChange(value => { this.syncImpl.dryRun = value })
      )
    new Setting(contentEl)
      .setName("Don't delete anything")
      .setDesc("If set, files that would've been deleted are not actually deleted. This should mainly be set if you failed "
        + "to download before making changes, and don't wish to discard the changes you made. "
      )
      .addToggle(toggle => 
        toggle
          .setValue(this.syncImpl.deleteIsNoop)
          .onChange(value => { this.syncImpl.deleteIsNoop = value })
      )
    new Setting(contentEl)
      .setName("Block vault wipes")
      .setDesc(
        "Whether or not to prevent pushes or pulls that would wipe the entire vault, or everything outside the "
        + ".obsidian folder. This should be left as true unless you really want to do something likely very dumb, "
        + "in which case, you're on your own."
      )
      .addToggle(toggle => 
        toggle
          .setValue(this.syncImpl.blockWipes)
          .onChange(value => { this.syncImpl.blockWipes = value })
      )

    const btnWrapper = contentEl.createDiv({
      cls: ["webdav-button-wrapper", "webdav-flex"]
    });
    // TODO: These buttons really should be styled, but I don't know which colours make sense
    // to associate with each action, so might as well leave them plain for now.
    const up = btnWrapper.createEl("button", {
      attr: {
        id: "webdav-sync-up"
      }
    });
    up.addEventListener("click", async (ev) => {
      await this.upload(ev);
    });
    const down = btnWrapper.createEl("button", {
      attr: {
        id: "webdav-sync-down"
      }
    });
    down.addEventListener("click", async (ev) => {
      await this.download(ev);
    });

    setIcon(up, "upload");
    setIcon(down, "download");

    up.createSpan({
      text: "\u00A0Upload"
    });
    down.createSpan({
      text: "\u00A0Download"
    });

    this.dryRunInfoContainer = this.contentEl.createEl("div", {
      attr: {
        id: "dry-run-info-container"
      }
    });
  }

  async download(ev: Event) {
    this.checkClearDryRun();

    await this.syncImpl.download(ev);
  }
  async upload(ev: Event) {
    this.checkClearDryRun();

    await this.syncImpl.upload(ev);
  }

  showTaskGraph(actions: Actions, info: DryRunInfo) {
    if (actions.size == 0) {
      new Notice("No changes would be made", 15000);
      return;
    }
    if (this.dryRunInfoContainer.children.length == 0) {
      this.dryRunInfoContainer.createEl("p", {
        text: (info.direction == SyncDir.DOWN ? "Downloading from" : "Uploading to") + " WebDAV server"
      });
    }
    if (info.subfolder != null) {
      this.dryRunInfoContainer.createEl("h2", {
        text: "Folder sync: " + info.subfolder
      });
    } else {
      this.dryRunInfoContainer.createEl("p", {
        text: "Operating on full vault"
      });
    }
    // I hate this so fucking much, but the function being dynamic means this is forced
    const table = this.dryRunInfoContainer.createEl("table");
    const thead = table.createEl("thead");
    const theadTr = thead.createEl("tr");
    theadTr.createEl("th", {
      text: "File"
    });
    theadTr.createEl("th", {
      text: "Action"
    });
    const body = table.createEl("tbody");

    for (let [file, action] of actions) {
      const row = body.createEl("tr");
      row.createEl("td", {
        text: file
      });
      row.createEl("td", {
        text: actionToDescriptiveString(action)
      });
    }
  }

  setLoading(elem: any) {
    setIcon(elem, "loader");
    elem.innerText = "";
  }

  setError(err: string) {
    new Notice(err);
  }

  checkClearDryRun() {
    if (this.syncImpl.dryRun) {
      this.dryRunInfoContainer.empty();
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
