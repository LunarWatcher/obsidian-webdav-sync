import {App, Modal, normalizePath, Notice, setIcon, Setting} from "obsidian";
import MyPlugin from "../main";
import {canConnectWithSettings} from "settings";
import {Actions, actionToDescriptiveString, ActionType, calculateSyncActions, Content, FileData, Files, Folder, Path, runSync, SyncDir } from "./sync";
import {FileStat} from "webdav";
import {FolderDestination} from "./sync_settings";

interface DryRunInfo {
  direction: SyncDir;
  subfolder: string | null;
}

export interface RemoteFileResult {
  content: Content | null;
  error: string | null;
};

export class UploadModal extends Modal {
  plugin: MyPlugin;
  dryRun: boolean;
  deleteIsNoop: boolean;
  dryRunInfoContainer: HTMLDivElement;

  constructor(app: App, plugin: MyPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;

    this.dryRun = false;
    this.deleteIsNoop = false;

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
          .setValue(this.dryRun)
          .onChange(value => { this.dryRun = value })
      )
    new Setting(contentEl)
      .setName("Don't delete anything")
      .setDesc("If set, files that would've been deleted are not actually deleted. This should mainly be set if you failed "
        + "to download before making changes, and don't wish to discard the changes you made. "
      )
      .addToggle(toggle => 
        toggle
          .setValue(this.deleteIsNoop)
          .onChange(value => { this.deleteIsNoop = value })
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

    this.dryRunInfoContainer = this.contentEl.createEl("div", {
      attr: {
        id: "dry-run-info-container"
      }
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

  setLoading(elem: any) {
    setIcon(elem, "loader");
    elem.innerText = "";
  }

  setError(err: string) {
    new Notice(err);
  }

  checkClearDryRun() {
    if (this.dryRun) {
      this.dryRunInfoContainer.empty();
    }
  }

  async upload(ev: any) {
    if (this.plugin.client == null) {
      return;
    }
    this.checkClearDryRun();
    let local = await this.getVaultFiles();
    // TODO: There must be a way to merge both branches of the if statement. There's a _lot_ of duplicated code
    // Also applies to upload()
    if (this.plugin.settings.sync.full_vault_sync) {
      let remoteResult = await this.getRemoteFiles(this.plugin.settings.sync.root_folder.dest);
      if (remoteResult.error) {
        this.setError(remoteResult.error);
        return;
      }

      const remote = remoteResult.content as Content;
      let actions = calculateSyncActions(
        local.files,
        remote.files,
        false,
        this.deleteIsNoop
      );
      
      if (!this.dryRun) {
        this.setLoading(ev.target);
        const { actionedCount, actionedFolders, errorCount } = await runSync(
          SyncDir.UP,
          local,
          remote,
          actions,
          this.setError,
          this.updateUpload.bind(
            this,
            this.plugin.settings.sync.root_folder.dest,
            null
          ),
          this.resolveConflict,
          this.deleteIsNoop,
        )

        new Notice(`Push complete. ${actionedCount} files were updated, and ${actionedFolders} stale folders were removed (${errorCount} errors).`);
        this.close();
      } else {
        console.log("remote: ", remote);
        console.log("local: ", local);
        this.showTaskGraph(actions, {
          direction: SyncDir.UP,
          subfolder: null
        });
      }
    } else {
      for (const vaultPath in this.plugin.settings.sync.subfolders) {
        // Typescript: are you fucking stupid?
        const { dest } = this.plugin.settings.sync.subfolders[vaultPath] as FolderDestination;
        let local = await this.getVaultFiles(vaultPath);
        
        let remoteResult = await this.getRemoteFiles(dest);
        if (remoteResult.error) {
          this.setError(remoteResult.error);
          return;
        }
        const remote = remoteResult.content as Content;
        let actions = calculateSyncActions(
          local.files,
          remote.files,
          false,
          this.deleteIsNoop
        );

        if (!this.dryRun) {
          this.setLoading(ev.target);
          const { actionedCount, actionedFolders, errorCount } = await runSync(
            SyncDir.UP,
            local,
            remote,
            actions,
            this.setError,
            this.updateUpload.bind(
              this,
              dest,
              vaultPath
            ),
            this.resolveConflict,
            this.deleteIsNoop
          )
          new Notice(`Push complete. ${actionedCount} files were updated, and ${actionedFolders} stale folders were removed (${errorCount} errors).`);
          this.close();
        } else {
          this.showTaskGraph(actions, {
            direction: SyncDir.UP,
            subfolder: vaultPath
          });
        }
      }
    }
  }

  async download(ev: any) {
    if (this.plugin.client == null) {
      return;
    }
    this.checkClearDryRun();
    if (this.plugin.settings.sync.full_vault_sync) {
      let local = await this.getVaultFiles();
      let remoteResult = await this.getRemoteFiles(this.plugin.settings.sync.root_folder.dest);
      if (remoteResult.error) {
        this.setError(remoteResult.error);
        return;
      }

      const remote = remoteResult.content as Content;
      let actions = calculateSyncActions(
        remote.files,
        local.files,
        false,
        this.deleteIsNoop
      );

      if (!this.dryRun) {
        this.setLoading(ev.target);
        const { actionedCount, actionedFolders, errorCount } = await runSync(
          SyncDir.DOWN,
          remote,
          local,
          actions,
          this.setError,
          this.updateDownload.bind(
            this,
            this.plugin.settings.sync.root_folder.dest,
            null
          ),
          this.resolveConflict,
          this.deleteIsNoop,
        )
        new Notice(`Pull complete. ${actionedCount} files were updated, and ${actionedFolders} stale folders were removed (${errorCount} errors).`);
        this.close();
      } else {
        console.log("remote: ", remote);
        console.log("local: ", local);
        this.showTaskGraph(actions, {
          direction: SyncDir.DOWN,
          subfolder: null
        });
      }
    } else {
      for (const vaultPath in this.plugin.settings.sync.subfolders) {
        // Typescript: are you fucking stupid?
        const { dest } = this.plugin.settings.sync.subfolders[vaultPath] as FolderDestination;
        let local = await this.getVaultFiles(vaultPath);
        
        let remoteResult = await this.getRemoteFiles(dest);
        if (remoteResult.error) {
          this.setError(remoteResult.error);
          return;
        }

        const remote = remoteResult.content as Content;
        let actions = calculateSyncActions(
          remote.files,
          local.files,
          false,
          this.deleteIsNoop
        );

        if (!this.dryRun) {
          this.setLoading(ev.target);
          const { actionedCount, actionedFolders, errorCount } = await runSync(
            SyncDir.DOWN,
            remote,
            local,
            actions,
            this.setError,
            this.updateDownload.bind(
              this,
              dest,
              vaultPath,
            ),
            this.resolveConflict,
            this.deleteIsNoop,
          )
          new Notice(`Pull complete. ${actionedCount} files were updated, and ${actionedFolders} stale folders were removed (${errorCount} errors).`);
          this.close();
        } else {
          this.showTaskGraph(actions, {
            direction: SyncDir.DOWN,
            subfolder: vaultPath
          });
        }
      }
    }
  }

  async updateDownload(
    dest: string,
    localPrefix: string | null,
    type: ActionType,
    file: string,
    srcData: FileData | undefined,
    _destData: FileData | undefined
  ) {
    if (this.plugin.client == null) {
      throw Error("This should never throw, but exists to make typescript shut up");
    }
    if (type == ActionType.ADD_LOCAL) {
      throw Error("Unexpected ADD_LOCAL; this should've been processed by now");
    }
    let localPath = this.prefixToStr(localPrefix) 
      + file;
    switch (type) {
      case ActionType.ADD:
        if (srcData == null) { throw new Error("This should never throw"); }
        if (localPath.replace("\\", "/").contains("/")) {
          const parentPath = localPath.replace("\\", "/")
            .split("/")
            .slice(0, -1)
            .join("/");
          if (!(await this.plugin.adapter().exists(parentPath))) {
            await this.app.vault.adapter.mkdir(
              normalizePath(
                parentPath
              )
            );
          }
        }
        await this.app.vault.adapter.writeBinary(
          normalizePath(localPath),
          await this.plugin.client.client.getFileContents(
            this.resolvePath(
              dest,
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
        if (this.deleteIsNoop) {
          new Notice("WebDAV bug: violation of no delete identified. Please open a bug report. Path: " + file);
          return
        }
        await this.app.vault.adapter.remove(
          normalizePath(localPath)
        );
        break;
    }
  }

  async updateUpload(
    dest: string,
    localPrefix: string | null,
    type: ActionType,
    file: string,
    srcData: FileData | undefined,
    _destData: FileData | undefined
  ) {
    if (this.plugin.client == null) {
      throw Error("This should never throw");
    }
    if (type == ActionType.ADD_LOCAL) {
      throw Error("Unexpected ADD_LOCAL; this should've been processed by now");
    }
    switch (type) {
      case ActionType.ADD:
        if (srcData == undefined) { throw new Error("This should never throw"); }
        await this.plugin.client.client.putFileContents(
          dest
          + "/"
          + file,
          await this.app.vault.adapter.readBinary(
            this.prefixToStr(localPrefix)
              + file
          ), {
            overwrite: true,
            headers: {
              "X-OC-MTime": Math.floor((srcData.lastModified || -1) / 1000).toString()
            }
          }
        );
        break;
      case ActionType.REMOVE:
        if (this.deleteIsNoop) {
          new Notice(
            "WebDAV bug: violation of no delete identified. Please open a bug report. Path: " + file
          );
          return
        }
        await this.plugin.client.client.deleteFile(
          dest
          + "/"
          + file
        );
        break;
    }
  }

  resolvePath(webdav: string, file: string) {
    return webdav + "/" + file
  }

  async getVaultFiles(root: string = "/"): Promise<Content> {
    //const files = this.app.vault.getFiles();
    const queue: any[] = [];

    if (!(await this.plugin.adapter().exists(normalizePath(root)))) {
      return {
        files: new Map(),
        folderPaths: []
      } as Content
    }

    const outFolders = [] as Folder[];

    queue.push(root);
    const files: { path: string, lastModified: number | null }[] = [];
    while (queue.length > 0) {
      const elem = queue.pop() as string;
      const next = await this.app.vault.adapter.list(
        normalizePath(elem)
      );
      // Don't push the root folder (deletion of the root folder is an irrelevant edge-case, because a deleted root folder 
      // means the entire vault or an entire shared subfolder has been deleted, and we can't delete root-level folders
      // in the webdav share. The plugin will also likely be gone at this point, at which point everything is UB anyway)
      if (elem != root) {
        if (root == "/") {
          outFolders.push({
            realPath: elem,
            commonPath: elem
          } as Folder);
        } else {
          outFolders.push({
            realPath: elem,
            commonPath: this.stripPrefix(elem, root)
          } as Folder);
        }
      }
      queue.push(...next.folders);
      for (const file of next.files) {
        if (this.shouldIgnore(file)) {
          continue;
        }
        const stat = await this.app.vault.adapter.stat(file);
        files.push({
          path: file,
          lastModified: stat?.mtime || null,
        });
      }
    }

    const out = new Map<Path, FileData>();

    for (const file of files) {
      let localFile = file.path.replace("\\", "/");
      let compliantDestinationMap = localFile;
      if (root != "/" && localFile.startsWith(root)) {
        // This only removes the first match, and we know it's always present in the path
        compliantDestinationMap = this.stripPrefix(
          compliantDestinationMap,
          root
        );
      }
      out.set(
        compliantDestinationMap,
        { 
          lastModified: file.lastModified,
          destination: localFile
        } as FileData
      )
    }

    return {
      files: out,
      folderPaths: outFolders
    }
  }

  stripPrefix(path: string, root: string) {
    return path.replace(
      root + (
        root.endsWith("/") ? "" : "/"
      ), ""
    )
  }

  shouldIgnore(file: string) {
    return this.plugin.settings.sync.ignore_workspace
      && (
        file.replace("\\", "/") == this.plugin.configDir() + "/workspace.json" 
        || file.replace("\\", "/") == this.plugin.configDir() + "/workspace-mobile.json"
      )
  }

  async resolveConflict(file: string, src: FileData, dest: FileData, dir: SyncDir): Promise<ActionType> {
    // TODO: handle properly
    // TODO: this likely cannot be a separate function
    return ActionType.ADD;
  }

  async getRemoteFiles(
    folder: string,
  ): Promise<RemoteFileResult> {
    if (this.plugin.client == null) {
      return {
        content: null,
        error: "No connection established"
      };
    }
    try {
      const files = await this.plugin.client.client.getDirectoryContents(
        folder, {
          deep: true,
        }
      ) as FileStat[];
      const folders = [] as Folder[];
      const out = new Map();

      for (const file of files) {
        // Obsidian does not include directories, so this is necessary to avoid every folder
        // being marked for removal
        // TODO: this should mean that stub folders aren't deleted either. Separating them into a separate map
        // with special deletion logic is probably a good idea.
        if (file.type == "directory") {
          folders.push({
            realPath: file.filename.replace(folder + "/", ""),
            commonPath: file.filename.replace(folder + "/", "")
          })
          continue;
        }
        if (this.shouldIgnore(file.filename)) {
          continue;
        }

        const sanitised = file.filename.replace(folder + (folder.endsWith("/") ? "" : "/"), "");
        out.set(
          sanitised,
          {
            lastModified: Date.parse(file.lastmod),
            destination: sanitised,
          } as FileData
        )
      }

      return {
        content: {
          files: out,
          folderPaths: folders,
        },
        error: null
      };
    } catch (ex) {
      if (ex instanceof Error) {
        if (ex.message.contains("Failed to fetch")) {
          return {
            content: null,
            error: "Failed to fetch from remote server. Has the server gone down?"
          };
        }
        new Notice("WebDAV error: " + ex.message);
      }
      throw ex;
    }
  }

  prefixToStr(prefix: string | null) {
    if (prefix == null) {
      return "";
    } else if (prefix.endsWith("/")) {
      return prefix;
    }
    return prefix + "/";
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
