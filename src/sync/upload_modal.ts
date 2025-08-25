import {App, Modal, setIcon, Setting} from "obsidian";
import MyPlugin from "../main";
import {canConnectWithSettings} from "settings";
import {FileData, Files, Path} from "./sync";

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
    up.addEventListener("click", this.upload);
    down.addEventListener("click", this.download);

    setIcon(up, "upload");
    setIcon(down, "download");

    // TODO: This is nasty
    up.innerHTML += "<span>&nbsp;Upload</span>";
    down.innerHTML += "<span>&nbsp;Download</span>";
  }

  upload(ev: any) {

  }

  download(ev: any) {

  }

  getVaultFiles(): Files {
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

  getRemoteFiles() {

  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
