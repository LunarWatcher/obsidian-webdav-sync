import {DAVServerConfig, DEFAULT_DAV_CONFIG} from "./fs/webdav";
import WebDAVSyncPlugin from "./main";
import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_SYNC_SETTINGS, FolderDestination, SyncSettings } from "./sync/sync_settings";
import {FileStat} from "webdav";

export interface settings_t {
  server_conf: DAVServerConfig;
  sync: SyncSettings;

}

export const DEFAULT_SETTINGS: settings_t = {
  server_conf: DEFAULT_DAV_CONFIG,
  sync: DEFAULT_SYNC_SETTINGS
}

export function canConnectWithSettings(settings: settings_t): boolean {
  return !!settings.server_conf.url
}

export class WebDAVSettingsTab extends PluginSettingTab {
  plugin: WebDAVSyncPlugin;

  constructor(app: App, plugin: WebDAVSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const {containerEl} = this;

    containerEl.empty();
    { 
      new Setting(containerEl)
        .setName('WebDAV URL')
        .setDesc('URL to your WebDAV share')
        .addText(text => text
          .setPlaceholder('https://dav.example.com')
          .setValue(this.plugin.settings.server_conf.url || "")
          .onChange(async (value) => {
            this.plugin.settings.server_conf.url = value || null;
            await this.plugin.saveSettings();
          }));
      new Setting(containerEl)
        .setName('WebDAV username')
        .setDesc('The username to use for authentication')
        .addText(text => text
          .setPlaceholder('LunarWatcher')
          .setValue(this.plugin.settings.server_conf.username || "")
          .onChange(async (value) => {
            this.plugin.settings.server_conf.username = value == "" ? undefined : value;
            await this.plugin.saveSettings();
          }));
      new Setting(containerEl)
        .setName('WebDAV password')
        .setDesc(
          'The password to use for authentication. WARNING: will be stored in plain text, and synced to the remote device. '
          + 'Make sure you trust your DAV provider!'
        )
        .addText(text => text
          .setPlaceholder('password69420')
          .setValue(this.plugin.settings.server_conf.password || "")
          .onChange(async (value) => {
            this.plugin.settings.server_conf.password = value == "" ? undefined : value;
            await this.plugin.saveSettings();
          })
          // Has to be last because this returns a void
          .inputEl.setAttribute("type", "password")
        );
      new Setting(containerEl)
        .setName('Restart connection to WebDAV server')
        .setDesc("You'll want to do this after changing WebDAV server settings")
        .addButton(btn => btn
          .setButtonText("Reload plugin")
          .onClick(async () => {
            if (await this.plugin.reloadClient()) {
              // TODO: This is supposed to check that the client is connected, but that's not correct.
              // The client doesn't actually establish a connection, so there's no way to verify that it is
              // connected without a webdav share to test against
              new Notice("Reloaded");
            }
          })
        );
    }
    {
      // .setHeading() seems to work now, but it's just another div rather than a proper <h2>
      // Much worse for accessibility, but this is forced by obsidian's plugin guidelines, so it's on them
      new Setting(containerEl).setName("Sync").setHeading();
      new Setting(containerEl)
        .setName("Full vault sync")
        .setDesc(
          "Whether or not to sync the full vault. This option is mutually exclusive with partial vault sync, and "
          + "must be disabled for folder mappings to take effect."
        )
        .addToggle(toggle =>
            toggle
              .setValue(this.plugin.settings.sync.full_vault_sync)
              .onChange(async (value) => {
                this.plugin.settings.sync.full_vault_sync = value
                await this.plugin.saveSettings();
              })
        )
      new Setting(containerEl)
        .setName("Ignore workspace files")
        .setDesc(
          "Whether or not to sync workspace.json and workspace-mobile.json. Leaving this off is strongly encouraged. "
          + "The workspace files contain some information about editor state. As such, it's highly prone to "
          + "conflicts, because any change in the layout will also update these files. "
          + "There's no consequences for turning it beyond needing to decide which to keep at a potentially "
          + "higher rate, as simply opening files in obsidian is enough to cause conflicts."
        )
        .addToggle(toggle =>
            toggle
              .setValue(this.plugin.settings.sync.ignore_workspace)
              .onChange(async (value) => {
                this.plugin.settings.sync.ignore_workspace = value
                await this.plugin.saveSettings();
              })
        )

      new Setting(containerEl)
        .setName("WebDAV share for the full vault")
        .setDesc("Where to sync the full vault to. This is a path relative to the WebDAV server")
        .addText(text => 
          text.setPlaceholder("/livi/obsidian")
            .setValue(this.plugin.settings.sync.root_folder.dest)
            .onChange(async (value) => {
              this.plugin.settings.sync.root_folder.dest = value
              await this.plugin.saveSettings()
            })
        )
        .addButton(button => button
          .setButtonText("Test connection")
          .setCta()
          .onClick(async (ev) => {
            await this.plugin.reloadClient();
            if (this.plugin.client != null) {
              const client = this.plugin.client.client;
              if (this.plugin.settings.sync.root_folder.dest != "") {
                try {
                  let contents = (await client.getDirectoryContents(this.plugin.settings.sync.root_folder.dest)) as FileStat[];
                  new Notice(
                    `Connection succeeded. Found folder with ${contents.length} direct files and folders.`
                  )
                } catch (ex) {
                  console.error(ex);
                  new Notice("Connection failed");
                }
              } else {
                new Notice(
                  "Can't test connection without a vault folder"
                );
              }
            }
          }).buttonEl.id = "webdav-settings-test-connection"
        )

      let newShare: string = "";
      let newVaultFolder: string = "";
      new Setting(containerEl)
        .setName("Folder mapping")
        .setDesc("Used to add sub-maps of the obsidian vault, meaning a specific subfolder that's "
                + "synced when the rest of the vault isn't.")
        .addText(text => 
          text.setPlaceholder("/webdav/share/path")
            .onChange(value => {
              newShare = value;
            })
        )
        .addText(text => 
          text.setPlaceholder("absolute/path/in/vault")
            .onChange(value => {
              newVaultFolder = value;
            })
        )
        .addButton(button =>
          button.setButtonText("Add")
            .setCta()
            .onClick(async () => {
              if (!newShare?.startsWith("/")) {
                new Notice("WebDAV share must start with a /");
                return;
              }
              if (newVaultFolder?.startsWith("/")) {
                new Notice("Vault folder must not start with a /");
                return;
              }

              this.plugin.settings.sync.subfolders[newVaultFolder] = {
                dest: newShare
              } as FolderDestination;
              await this.plugin.saveSettings()
              this.display();
            })
        );
      containerEl.createDiv({
        attr: {
          id: "folder-mappings"
        }
      })
      this.regenerateFolderMappings();
    }
    new Setting(containerEl).setName("Meta").setHeading();

    containerEl.createEl("p", {
      text: "Running into issues? Open an issue on "
    }).createEl("a", {
      text: "GitHub.",
      href: "https://github.com/LunarWatcher/obsidian-webdav-sync"
    });
    containerEl.createEl("p", {
      text: "Trans rights are human rights 🏳️‍⚧️ 🏳️‍🌈"
    })
  }

  regenerateFolderMappings() {
    const container = document.getElementById("folder-mappings") as HTMLDivElement;
    container.empty();

    // Fuck you javascript, why can I not `of` a dict?
    for (const path in this.plugin.settings.sync.subfolders) {
      const dest = this.plugin.settings.sync.subfolders[path];

      new Setting(container)
        .setName("WebDAV target folder for vault path: " + path)
        .addText(text => {
          text.setValue(dest.dest)
            .onChange(async (value) => {
              const lastDest = this.plugin.settings.sync.subfolders[path] as FolderDestination | null;
              if (lastDest?.dest.startsWith("/")) {
                lastDest.dest = value;

                this.plugin.settings.sync.subfolders[path] = lastDest;
                await this.plugin.saveSettings()
              }
            })
        })
        .addButton(button => button.setIcon("trash").setWarning().onClick(async () => {
          delete this.plugin.settings.sync.subfolders[path];
          await this.plugin.saveSettings();
          this.display();
        }))
    }
  }
  
}
