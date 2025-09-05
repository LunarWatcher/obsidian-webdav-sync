import {normalizePath, Notice} from "obsidian";
import {Actions, ActionType, calculateSyncActions, Content, FileData, OnErrorHandler, Path, runSync, SyncDir} from "./sync";
import {FolderDestination} from "./sync_settings";
import WebDAVSyncPlugin from "main";
import {FileProvider} from "./files";
import {prefixToStr, resolvePath} from "./pathutils";

export interface DryRunInfo {
  direction: SyncDir;
  subfolder: string | null;
}

export type TaskGraphHandler = (actions: Actions, info: DryRunInfo) => void;
export type OnCompleteHandler = (dryRun: boolean) => void;
export class SyncImpl {
  plugin: WebDAVSyncPlugin;
  dryRun: boolean;
  deleteIsNoop: boolean;
  dryRunInfoContainer: HTMLDivElement;
  onError: OnErrorHandler;
  onComplete: OnCompleteHandler;
  showTaskGraph: TaskGraphHandler;
  fileProvider: FileProvider;

  /**
   * @param onError         Invoked if an error occurs. Does not control termination; this is basically
   *                        just a logger
   * @param showTaskGraph   Used in dry runs. Must be bound before being passed if `this` is used.
   * @param onComplete      Invoked after a completed, non-dry run. Like showTaskGraph, must be bound
   *                        to `this` before being passed in.
   */
  constructor(
    plugin: WebDAVSyncPlugin,
    onError: OnErrorHandler,
    showTaskGraph: TaskGraphHandler,
    onComplete: OnCompleteHandler,
    dryRun: boolean = false,
    deleteIsNoop: boolean = false
  ) {
    this.plugin = plugin;
    this.onError = onError;
    this.showTaskGraph = showTaskGraph;
    this.onComplete = onComplete;
    this.dryRun = dryRun;
    this.deleteIsNoop = deleteIsNoop;

    this.fileProvider = new FileProvider(
      plugin
    )
  }

  async upload(ev: any) {
    if (this.plugin.client == null) {
      return;
    }
    let local = await this.fileProvider.getVaultFiles();
    // TODO: There must be a way to merge both branches of the if statement. There's a _lot_ of duplicated code
    // Also applies to upload()
    if (this.plugin.settings.sync.full_vault_sync) {
      let remoteResult = await this.fileProvider.getRemoteFiles(this.plugin.settings.sync.root_folder.dest);
      if (remoteResult.error) {
        this.onError(remoteResult.error);
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
        const { actionedCount, actionedFolders, errorCount } = await runSync(
          SyncDir.UP,
          local,
          remote,
          actions,
          this.onError,
          this.updateUpload.bind(
            this,
            this.plugin.settings.sync.root_folder.dest,
            null
          ),
          this.resolveConflict,
          this.deleteIsNoop,
        )

        new Notice(`Push complete. ${actionedCount} files were updated, and ${actionedFolders} stale folders were removed (${errorCount} errors).`);
        this.onComplete(this.dryRun);
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
        const { dest } = this.plugin.settings.sync.subfolders[vaultPath] as FolderDestination;
        let local = await this.fileProvider.getVaultFiles(vaultPath);
        
        let remoteResult = await this.fileProvider.getRemoteFiles(dest);
        if (remoteResult.error) {
          this.onError(remoteResult.error);
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
          const { actionedCount, actionedFolders, errorCount } = await runSync(
            SyncDir.UP,
            local,
            remote,
            actions,
            this.onError,
            this.updateUpload.bind(
              this,
              dest,
              vaultPath
            ),
            this.resolveConflict,
            this.deleteIsNoop
          )
          new Notice(`Push complete. ${actionedCount} files were updated, and ${actionedFolders} stale folders were removed (${errorCount} errors).`);
          this.onComplete(this.dryRun);
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
    if (this.plugin.settings.sync.full_vault_sync) {
      let local = await this.fileProvider.getVaultFiles();
      let remoteResult = await this.fileProvider.getRemoteFiles(this.plugin.settings.sync.root_folder.dest);
      if (remoteResult.error) {
        this.onError(remoteResult.error);
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
        const { actionedCount, actionedFolders, errorCount } = await runSync(
          SyncDir.DOWN,
          remote,
          local,
          actions,
          this.onError,
          this.updateDownload.bind(
            this,
            this.plugin.settings.sync.root_folder.dest,
            null
          ),
          this.resolveConflict,
          this.deleteIsNoop,
        )
        new Notice(`Pull complete. ${actionedCount} files were updated, and ${actionedFolders} stale folders were removed (${errorCount} errors).`);
        this.onComplete(this.dryRun);
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
        let local = await this.fileProvider.getVaultFiles(vaultPath);
        
        let remoteResult = await this.fileProvider.getRemoteFiles(dest);
        if (remoteResult.error) {
          this.onError(remoteResult.error);
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
          const { actionedCount, actionedFolders, errorCount } = await runSync(
            SyncDir.DOWN,
            remote,
            local,
            actions,
            this.onError,
            this.updateDownload.bind(
              this,
              dest,
              vaultPath,
            ),
            this.resolveConflict,
            this.deleteIsNoop,
          )
          new Notice(`Pull complete. ${actionedCount} files were updated, and ${actionedFolders} stale folders were removed (${errorCount} errors).`);
          this.onComplete(this.dryRun);
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
    destData: FileData | undefined
  ) {
    if (this.plugin.client == null) {
      throw Error("This should never throw, but exists to make typescript shut up");
    }
    if (type == ActionType.ADD_LOCAL) {
      throw Error("Unexpected ADD_LOCAL; this should've been processed by now");
    }
    let localPath = prefixToStr(localPrefix) 
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
            await this.plugin.app.vault.adapter.mkdir(
              normalizePath(
                parentPath
              )
            );
          }
        }
        await this.plugin.app.vault.adapter.writeBinary(
          normalizePath(localPath),
          await this.plugin.client.client.getFileContents(
            resolvePath(
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

        if (destData == undefined) {
          await this.plugin.app.vault.adapter.rmdir(
            normalizePath(localPath),
            false
          );
        } else {
          await this.plugin.app.vault.adapter.remove(
            normalizePath(localPath)
          );
        }
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
          await this.plugin.app.vault.adapter.readBinary(
            prefixToStr(localPrefix)
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

  async resolveConflict(file: string, src: FileData, dest: FileData, dir: SyncDir): Promise<ActionType> {
    // TODO: handle properly (and probably convert to a callback function)
    return ActionType.ADD;
  }
}
function getRemoteFiles(dest: string) {
  throw new Error("Function not implemented.");
}

