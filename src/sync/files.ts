import {FileStat} from "webdav";
import {RemoteFileResult} from "./sync_modal";
import {Content, FileData, Folder, Path} from "./sync";
import {normalizePath, Notice} from "obsidian";
import WebDAVSyncPlugin from "main";
import {stripPrefix} from "./pathutils";

export class FileProvider {
  plugin: WebDAVSyncPlugin;
  constructor(
    plugin: WebDAVSyncPlugin,
  ) {
    this.plugin = plugin;
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
      const files: FileStat[] = await this.plugin.client.client.getDirectoryContents(
        folder, {
          deep: true,
        }
      );
      const folders = [] as Folder[];
      const out = new Map<Path, FileData>();

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

  async getVaultFiles(
    root: string = "/"
  ): Promise<Content> {
    //const files = this.app.vault.getFiles();
    const queue: string[] = [];

    if (!(await this.plugin.adapter().exists(normalizePath(root)))) {
      return {
        files: new Map<Path, FileData>(),
        folderPaths: []
      } as Content
    }

    const outFolders = [] as Folder[];

    queue.push(root);
    const files: { path: string, lastModified: number | null }[] = [];
    while (queue.length > 0) {
      const elem = queue.pop() as string;
      const next = await this.plugin.adapter().list(
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
            commonPath: stripPrefix(elem, root)
          } as Folder);
        }
      }
      queue.push(...next.folders);
      for (const file of next.files) {
        if (this.shouldIgnore(file)) {
          continue;
        }
        const stat = await this.plugin.adapter().stat(file);
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
        compliantDestinationMap = stripPrefix(
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

  shouldIgnore(file: string) {
    return this.plugin.settings.sync.ignore_workspace
      && (
        file.replace("\\", "/") == this.plugin.configDir() + "/workspace.json" 
        || file.replace("\\", "/") == this.plugin.configDir() + "/workspace-mobile.json"
      )
  }
}
