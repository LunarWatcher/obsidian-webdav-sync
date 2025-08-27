import {App, Modal, normalizePath, Notice, setIcon, Setting} from "obsidian";
import MyPlugin from "../main";
import {canConnectWithSettings} from "settings";
import {Actions, actionToDescriptiveString, ActionType, calculateSyncActions, FileData, Files, Path, runSync, SyncDir } from "./sync";
import {FileStat} from "webdav";

export interface RemoteFileResult {
  files: Files | null;
  error: string | null;
};

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
    if (actions.size == 0) {
      new Notice("No changes would be made", 15000);
      return;
    }
    const tab = document.getElementById("dry-run-info") as HTMLTableElement;
    const body = document.getElementById("dry-run-data") as HTMLTableSectionElement;
    body.empty();

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

  setLoading(elem: any) {
    setIcon(elem, "loader");
    elem.innerText = "";
  }

  setError(err: string) {
    new Notice(err);
  }

  async upload(ev: any) {
    if (this.plugin.client == null) {
      return;
    }
    let local = await this.getVaultFiles();
    if (this.plugin.settings.sync.full_vault_sync) {
      let remoteResult = await this.getRemoteFiles(this.plugin.settings.sync.root_folder.dest);
      if (remoteResult.error) {
        this.setError(remoteResult.error);
        return;
      }

      const remote = remoteResult.files as Files;
      let actions = calculateSyncActions(local, remote);
      
      if (!this.dryRun) {
        this.setLoading(ev.target);
        const { actionedCount } = await runSync(
          SyncDir.DOWN,
          local,
          remote,
          actions,
          this.setError,
          this.updateUpload.bind(this),
          this.resolveConflict
        )

        new Notice(`Push complete. ${actionedCount} files were updated.`);
        this.close();
      } else {
        console.log("remote: ", remote);
        console.log("local: ", local);
        this.showTaskGraph(actions, true);
      }
    }
  }

  async download(ev: any) {
    if (this.plugin.client == null) {
      return;
    }
    let local = await this.getVaultFiles();
    if (this.plugin.settings.sync.full_vault_sync) {
      let remoteResult = await this.getRemoteFiles(this.plugin.settings.sync.root_folder.dest);
      if (remoteResult.error) {
        this.setError(remoteResult.error);
        return;
      }

      const remote = remoteResult.files as Files;
      let actions = calculateSyncActions(remote, local);

      if (!this.dryRun) {
        this.setLoading(ev.target);
        const { actionedCount } = await runSync(
          SyncDir.DOWN,
          remote,
          local,
          actions,
          this.setError,
          this.updateDownload.bind(this),
          this.resolveConflict
        )
        new Notice(`Pull complete. ${actionedCount} files were updated.`);
        this.close();
      } else {
        console.log("remote: ", remote);
        console.log("local: ", local);
        this.showTaskGraph(actions, false);
      }
    }
  }

  async updateDownload(
    type: ActionType,
    file: string,
    _localData: FileData,
    remoteData: FileData
  ): Promise<string | null> {
    if (this.plugin.client == null) {
      throw Error("This should never throw");
    }
    if (type == ActionType.ADD_LOCAL) {
      throw Error("Unexpected ADD_LOCAL; this should've been processed by now");
    }
    switch (type) {
      case ActionType.ADD:
        await this.app.vault.adapter.writeBinary(
          normalizePath(file),
          await this.plugin.client.client.getFileContents(
            this.resolvePath(
              this.plugin.settings.sync.root_folder.dest,
              file
            ), {
              format: "binary"
            }
          ) as ArrayBuffer, {
            mtime: remoteData.lastModified as number
          }
        );
        break;
      case ActionType.REMOVE:
        await this.app.vault.adapter.remove(
          normalizePath(file)
        );
        break;
    }
    return null;
  }

  async updateUpload(
    type: ActionType,
    file: string,
    localData: FileData,
    _remoteData: FileData
  ): Promise<string | null> {
    if (this.plugin.client == null) {
      throw Error("This should never throw");
    }
    if (type == ActionType.ADD_LOCAL) {
      throw Error("Unexpected ADD_LOCAL; this should've been processed by now");
    }
    switch (type) {
      case ActionType.ADD:
        await this.plugin.client.client.putFileContents(
          this.plugin.settings.sync.root_folder.dest 
          + "/"
          + file,
          await this.app.vault.adapter.readBinary(file), {
            overwrite: true,
            headers: {
              "X-OC-MTime": Math.floor((localData.lastModified || -1) / 1000).toString()
            }
          }
        );
        break;
      case ActionType.REMOVE:
        await this.plugin.client.client.deleteFile(
          this.plugin.settings.sync.root_folder.dest 
          + "/"
          + file
        );
        break;
    }
    return null;
  }

  resolvePath(webdav: string, file: string) {
    return webdav + "/" + file
  }

  async getVaultFiles(): Promise<Files> {
    //const files = this.app.vault.getFiles();
    const queue: any[] = [];

    queue.push("/");
    const files: { path: string, lastModified: number | null }[] = [];
    while (queue.length > 0) {
      const elem = queue.pop() as string;
      const next = await this.app.vault.adapter.list(
        normalizePath(elem)
      );
      queue.push(...next.folders);
      for (const file of next.files) {
        const stat = await this.app.vault.adapter.stat(file);
        files.push({
          path: file,
          lastModified: stat?.mtime || null,
        });
      }
    }

    const out = new Map<Path, FileData>();

    for (const file of files) {
      out.set(
        file.path.replace("\\", "/"),
        { 
          lastModified: file.lastModified
        } as FileData
      )
    }

    return out;
  }

  async resolveConflict(file: string, src: FileData, dest: FileData, dir: SyncDir): Promise<ActionType> {
    // TODO: handle properly
    // TODO: this likely cannot be a 
    return ActionType.ADD;
  }

  async getRemoteFiles(folder: string): Promise<RemoteFileResult> {
    if (this.plugin.client == null) {
      return {
        files: null,
        error: "No connection established"
      };
    }
    try {
      const files = await this.plugin.client.client.getDirectoryContents(
        folder, {
          deep: true,
        }
      ) as FileStat[];
      const out = new Map();

      for (const file of files) {
        // Obsidian does not include directories, so this is necessary to avoid every folder
        // being marked for removal
        // TODO: this should mean that stub folders aren't deleted either. Separating them into a separate map
        // with special deletion logic is probably a good idea.
        if (file.type == "directory") {
          continue;
        }

        out.set(
          file.filename.replace(folder + (folder.endsWith("/") ? "" : "/"), ""),
          {
            lastModified: Date.parse(file.lastmod)
          } as FileData
        )
      }

      return {
        files: out,
        error: null
      };
    } catch (ex) {
      if (ex instanceof Error) {
        if (ex.message.contains("Failed to fetch")) {
          return {
            files: null,
            error: "Failed to fetch from remote server. Has the server gone down?"
          };
        }
      } 
      throw ex;
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
