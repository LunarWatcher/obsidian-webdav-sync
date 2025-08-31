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
    contentEl.createEl("h1", {
      text: "WebDAV sync controls"
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
              + "for debugging, or just making sure you trust the plugin")
      .addToggle(toggle => 
        toggle.setValue(false)
      .onChange(value => { this.dryRun = value })
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

    // TODO: This is nasty, but it appears to be the only way for setIcon to not override
    // the text. Can't find an API for icon + text buttons
    up.innerHTML += "<span>&nbsp;Upload</span>";
    down.innerHTML += "<span>&nbsp;Download</span>";
  }

  showTaskGraph(actions: Actions, upload: boolean) {
    if (actions.size == 0) {
      new Notice("No changes would be made", 15000);
      return;
    }

    // I'm not doing this with Obsidian's API. Give me a table API and I'll do that, but this is
    // 6 separate calls with tracking of nested objects, with planned expansions. This code is
    // already unreadable enough as it is with all the non-standard API calls.
    this.contentEl.insertAdjacentHTML("beforeend", `<table id="dry-run-info">
      <thead>
        <tr>
          <th>File</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody id="dry-run-data">
      </tbody>
    </table>`);
    // The previous call is a void
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

      body.insertAdjacentElement("beforeend", elem);
    }
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
        const { actionedCount, errorCount } = await runSync(
          SyncDir.DOWN,
          local,
          remote,
          actions,
          this.setError,
          this.updateUpload.bind(this),
          this.resolveConflict
        )

        new Notice(`Push complete. ${actionedCount} files were updated (${errorCount} errors).`);
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
        const { actionedCount, errorCount } = await runSync(
          SyncDir.DOWN,
          remote,
          local,
          actions,
          this.setError,
          this.updateDownload.bind(this),
          this.resolveConflict
        )
        new Notice(`Pull complete. ${actionedCount} files were updated (${errorCount} errors).`);
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
    srcData: FileData,
    _destData: FileData
  ): Promise<string | null> {
    if (this.plugin.client == null) {
      throw Error("This should never throw, but exists to make typescript shut up");
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
            mtime: srcData.lastModified as number
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
    srcData: FileData,
    _destData: FileData
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
              "X-OC-MTime": Math.floor((srcData.lastModified || -1) / 1000).toString()
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
        if (
          this.plugin.settings.sync.ignore_workspace
          && (
            file.replace("\\", "/") == ".obsidian/workspace.json" 
            || file.replace("\\", "/") == ".obsidian/workspace-mobile.json"
          )
        ) {
          continue;
        }
        const stat = await this.app.vault.adapter.stat(file);
        files.push({
          path: file,
          lastModified: stat?.mtime || stat?.ctime || null,
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
    // TODO: this likely cannot be a separate function
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
        if (
          this.plugin.settings.sync.ignore_workspace
          && (
            file.filename.replace("\\", "/") == ".obsidian/workspace.json" 
            || file.filename.replace("\\", "/") == ".obsidian/workspace-mobile.json"
          )
        ) {
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
