import {App, Modal, Notice, setIcon, Setting} from "obsidian";
import WebDAVSyncPlugin from "../main";
import {canConnectWithSettings} from "settings";
import {Actions, actionToDescriptiveString, Content, OnErrorHandler, SyncDir } from "./sync";
import {DryRunInfo, OnCompleteHandler, SyncImpl, TaskGraphHandler} from "./sync_impl";

export interface RemoteFileResult {
  content: Content | null;
  error: string | null;
};

export class SyncModal extends Modal {
  plugin: WebDAVSyncPlugin;
  dryRunInfoContainer: HTMLDivElement;
  syncImpl: SyncImpl;

  down: HTMLButtonElement;
  up: HTMLButtonElement;

  constructor(app: App, plugin: WebDAVSyncPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;

    this.syncImpl = new SyncImpl(
      this.plugin,
      this.setError.bind(this) as OnErrorHandler,
      this.showTaskGraph.bind(this) as TaskGraphHandler,
      this.close.bind(this) as OnCompleteHandler,
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
        + `${this.app.vault.configDir} folder. This should be left as true unless you really want to do something likely very dumb, `
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
    this.up = btnWrapper.createEl("button", {
      attr: {
        id: "webdav-sync-up"
      }
    });
    this.up.addEventListener("click", () => {
      void this.upload();
    });
    this.down = btnWrapper.createEl("button", {
      attr: {
        id: "webdav-sync-down"
      }
    });
    this.down.addEventListener("click", () => {
      void this.download();
    });

    this.setLoadingState(false);
    setIcon(this.up, "upload");
    setIcon(this.down, "download");

    this.up.createSpan({
      text: "\u00A0Upload"
    });
    this.down.createSpan({
      text: "\u00A0Download"
    });

    this.dryRunInfoContainer = this.contentEl.createEl("div", {
      attr: {
        id: "dry-run-info-container"
      }
    });
  }

  async download() {
    this.setLoadingState(true);
    this.checkClearDryRun();

    await this.syncImpl.download()
      .then(() => {
        this.setLoadingState(false);
      })
      .catch((err) => {
        console.error(err);
        this.setLoadingState(false);
      });
  }
  async upload() {
    this.setLoadingState(true);
    this.checkClearDryRun();

    await this.syncImpl.upload()
      .then(() => {
        this.setLoadingState(false);
      })
      .catch((err) => {
        console.error(err);
        this.setLoadingState(false);
      });
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

  setLoadingState(
    running: boolean
  ) {
    if (running) {
      this.down.disabled = true;
      this.up.disabled = true;
    } else {
      this.down.disabled = false;
      this.up.disabled = false;
    }
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
