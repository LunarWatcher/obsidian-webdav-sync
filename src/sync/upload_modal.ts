import {App, Modal, normalizePath, Notice, setIcon, Setting} from "obsidian";
import MyPlugin from "../main";
import {canConnectWithSettings} from "settings";
import {Actions, actionToDescriptiveString, ActionType, calculateSyncActions, FileData, Files, Path} from "./sync";
import {BufferLike, FileStat} from "webdav";

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

  async upload(ev: any) {
    if (this.plugin.client == null) {
      return;
    }
    let local = await this.getVaultFiles();
    if (this.plugin.settings.sync.full_vault_sync) {
      let remote = await this.getRemoteFiles(this.plugin.settings.sync.root_folder.dest);
      let actions = calculateSyncActions(local, remote);
      
      if (!this.dryRun) {
        this.setLoading(ev.target);
        let actionedCount = 0;
        for (let [file, action] of actions) {
          let localData = local.get(file);
          // ADD_LOCAL needs to be first, so we don't have to redo value checks for action
          if (action == ActionType.ADD_LOCAL) {
            // Shut up typescript, you're drunk
            action = this.resolveConflict(file, localData as FileData, remote.get(file) as FileData);
          }

          if (action == ActionType.NOOP) {
            continue; 
          } else if (action == ActionType.REMOVE) {
            this.plugin.client.client.deleteFile(
              this.plugin.settings.sync.root_folder.dest 
                + "/"
                + file
            );
          } else if (action == ActionType.ADD) {
            this.plugin.client.client.putFileContents(
              this.plugin.settings.sync.root_folder.dest 
                + "/"
                + file,
                await this.app.vault.adapter.readBinary(file), {
                  overwrite: true,
                }
            );
          }

          actionedCount += 1;
        }

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
      let remote = await this.getRemoteFiles(this.plugin.settings.sync.root_folder.dest);
      let actions = calculateSyncActions(remote, local);

      if (!this.dryRun) {
        this.setLoading(ev.target);
        let actionedCount = 0;
        for (let [file, action] of actions) {
          // ADD_LOCAL needs to be first, so we don't have to redo value checks for action
          if (action == ActionType.ADD_LOCAL) {
            // Shut up typescript, you're drunk
            action = this.resolveConflict(file, local.get(file) as FileData, remote.get(file) as FileData);
          }

          if (action == ActionType.NOOP) {
            continue; 
          } else if (action == ActionType.REMOVE) {
            this.app.vault.adapter.remove(
              normalizePath(file)
            );
          } else if (action == ActionType.ADD) {
            let remoteData = remote.get(file) as FileData;
            this.app.vault.adapter.writeBinary(
              normalizePath(file),
              await this.plugin.client.client.getFileContents(
                this.resolvePath(
                  this.plugin.settings.sync.root_folder.dest,
                  file
                )
              ) as BufferLike, {
                mtime: remoteData.lastModified as number
              }
            );
            actionedCount += 1;
          }
        }
        new Notice(`Pull complete. ${actionedCount} files were updated.`);
        this.close();
      } else {
        console.log("remote: ", remote);
        console.log("local: ", local);
        this.showTaskGraph(actions, false);
      }
    }

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
      console.log(elem);
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

  resolveConflict(file: string, src: FileData, dest: FileData): ActionType {
    // TODO: handle properly
    return ActionType.ADD;
  }

  async getRemoteFiles(folder: string): Promise<Files> {
    console.log(folder);
    if (this.plugin.client == null) {
      return new Map();
    }
    const files = await this.plugin.client.client.getDirectoryContents(
      folder, {
        deep: true,
      }
    ) as FileStat[];
    const out = new Map();

    for (const file of files) {
      // Obsidian does not include directories, so this is necessary to avoid every folder
      // being marked for removal
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

    return out;
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
