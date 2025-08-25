import {App, Modal, setIcon, Setting} from "obsidian";
import MyPlugin from "../main";
import {canConnectWithSettings} from "settings";
import {Actions, actionToDescriptiveString, calculateSyncActions, FileData, Files, Path} from "./sync";
import {FileStat} from "webdav";

export class UploadModal extends Modal {
  plugin: MyPlugin;
  dryRun: boolean;

  constructor(app: App, plugin: MyPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.insertAdjacentHTML("beforeend", "<h1>WebDAV sync controls</h1>")
    
    if (!canConnectWithSettings(this.plugin.settings)) {
      contentEl.insertAdjacentHTML("beforeend", `
      <h2>No vault configured</h2>
      <p>You have not configured the sync connection settings. Please set a server, then try again</p>
      `)
      return
    }
    new Setting(contentEl)
      .setName("Dry run")
      .setDesc("If set, the plugin will only tell you what it would've done, but not actually do it. "
              + "Meaning tell you which files it would change, but not actually do the changes. Useful "
              + "for debugging, or just making sure you trust the plugin")
      .addToggle(toggle => 
        toggle.setValue(false)
      .onChange(value => { this.dryRun = value })
      )

    contentEl.insertAdjacentHTML("beforeend", `
    <div class="webdav-button-wrapper webdav-flex">
      <button id="webdav-sync-up"></button>
      <button id="webdav-sync-down"></button>
    </div>`);

    const up = document.getElementById("webdav-sync-up") as HTMLElement;
    const down = document.getElementById("webdav-sync-down") as HTMLElement;
    up.addEventListener("click", async (ev) => {await this.upload(ev)});
    down.addEventListener("click", async (ev) => {await this.download(ev)});

    setIcon(up, "upload");
    setIcon(down, "download");

    // TODO: This is nasty
    up.innerHTML += "<span>&nbsp;Upload</span>";
    down.innerHTML += "<span>&nbsp;Download</span>";

    contentEl.insertAdjacentHTML("beforeend", `<table style="display: none" id="dry-run-info">
      <thead>
        <tr>
          <th>File</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody id="dry-run-data">

      </tbody>
    </table>`);
  }

  showTaskGraph(actions: Actions, upload: boolean) {
    const tab = document.getElementById("dry-run-info") as HTMLTableElement;
    const body = document.getElementById("dry-run-data") as HTMLTableSectionElement;

    for (let [file, action] of actions) {
      // HTMLTableRowElement: *exists*
      // Typescript: I HAVE LITERALLY NEVER HEARD ABOUT THIS IN MY LIFE BEFORE WTF COULD YOU POSSIBLY MEEEAAANNNNN
      const elem = document.createElement("tr");
      const fromElem = document.createElement("td");
      const actionElem = document.createElement("td");

      fromElem.innerText = file;
      actionElem.innerText = actionToDescriptiveString(action);

      elem.append(
        fromElem,
        actionElem
      )

      body.append(elem);
    }
    tab.setAttr("style", "display: inline-block");
  }

  async upload(ev: any) {
    let local = await this.getVaultFiles();
    if (this.plugin.settings.sync.full_vault_sync) {
      let remote = await this.getRemoteFiles(this.plugin.settings.sync.root_folder.dest);
      let actions = calculateSyncActions(local, remote);

      if (!this.dryRun) {
        // TODO
      } else {
        this.showTaskGraph(actions, true);
      }
    }
  }

  async download(ev: any) {
    let local = await this.getVaultFiles();
    if (this.plugin.settings.sync.full_vault_sync) {
      let remote = await this.getRemoteFiles(this.plugin.settings.sync.root_folder.dest);
      let actions = calculateSyncActions(remote, local);

      if (!this.dryRun) {
        // TODO
      } else {
        this.showTaskGraph(actions, false);
      }
    }

  }

  async getVaultFiles(): Promise<Files> {
    const files = this.app.vault.getFiles();
    const out = new Map<Path, FileData>();

    for (const file of files) {
      out.set(
        file.path.replace("\\", "/"),
        { 
          lastModified: file.stat.mtime
        } as FileData
      )
    }

    return out;
  }

  async getRemoteFiles(folder: string): Promise<Files> {
    if (this.plugin.client == null) {
      return new Map();
    }
    const files = await this.plugin.client.client.getDirectoryContents(
      folder
    ) as FileStat[];
    const out = new Map();

    for (const file of files) {
      out.set(
        file.filename,
        {
          lastModified: Date.parse(file.lastmod)
        } as FileData
      )
    }

    return out;
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
