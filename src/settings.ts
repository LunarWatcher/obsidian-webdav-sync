import {DAVServerConfig, DEFAULT_DAV_CONFIG} from "./fs/webdav";
import WebDAVSyncPlugin from "./main";
import { App, Notice, PluginSettingTab, SecretComponent, Setting } from "obsidian";
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
    containerEl.createEl("p", {
      text: 'For more help, see the '
    })
      .createEl("a", {
        text: "documentation.",
        href: "https://lunarwatcher.github.io/obsidian-webdav-sync/"
      })
    {

      new Setting(containerEl)
        .setName('WebDAV URL')
        .setDesc('URL to your WebDAV server')
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
          'The password to use for authentication'
        )
        .addComponent(el => new SecretComponent(this.app, el)
          .setValue(this.plugin.settings.server_conf.password || "")
          .onChange(async (value) => {
            this.plugin.settings.server_conf.password = value;
            await this.plugin.saveSettings();
          })

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

                (document.getElementById("webdav-sync-add-subvault-map-btn") as HTMLButtonElement)
                  .disabled = value;
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
        .setName("Ignore config folder")
        .setDesc(
          "Whether or not to ignore the config folder (typically .obsidian). Mainly useful if you want to fully "
          + "separate the workspaces, and only sync the content. Note that this means you'll need to manually "
          + "install the sync plugin for other clients to be able to sync. This option will fully exclude the "
          + "config folder, so if you've previously uploaded it, you'll need to manually delete it if you want "
          + "it gone. This means the option to sync or not is fully device-local"
        )
        .addToggle(toggle =>
            toggle
              .setValue(this.plugin.settings.sync.ignore_config_folder)
              .onChange(async (value) => {
                this.plugin.settings.sync.ignore_config_folder = value
                await this.plugin.saveSettings();
              })
        )

      new Setting(containerEl)
        .setName("WebDAV share for the full vault")
        .setDesc(
          "Where to sync the full vault to. This is a path relative to the WebDAV server, and must not include "
          + "a full URL. Example of a legal value: /livi/obsidian"
        )
        .addText(text => {
          let el = text.setPlaceholder("/livi/obsidian")
            .setValue(this.plugin.settings.sync.root_folder.dest)
            .onChange(async (value) => {
              let el = document.getElementById("webdav-sync-full-vault-path") as HTMLInputElement;
              if (value.length > 0 && el.validity.patternMismatch) {
                // This triggers too often for it to be feasible to create a new notice on error.
                // new Notice(
                //   "The share path must be a path. The domain is defined by the WebDAV URL setting, and cannot be "
                //   + "included here. Example valid value: /some/path/relative/to/the/webdav/root"
                // )
                return;
              }
              this.plugin.settings.sync.root_folder.dest = value
              await this.plugin.saveSettings()
            })
            .inputEl;

          el.id = "webdav-sync-full-vault-path";
          el.pattern = '\\/(?:|[^\\/].*)'
          el.addClass("webdav-sync-validated");
        })
        .addButton(button => button
          .setButtonText("Test connection")
          .setCta()
          .onClick(async (_ev) => {
            await this.plugin.reloadClient();
            if (this.plugin.client != null) {
              const client = this.plugin.client.client;
              if (this.plugin.settings.sync.root_folder.dest != "") {
                try {
                  let contents: FileStat[] = await client.getDirectoryContents(this.plugin.settings.sync.root_folder.dest);
                  new Notice(
                    `Connection succeeded. Found folder with ${contents.length} direct files and folders.`
                  )
                } catch (ex) {
                  console.error(ex);
                  new Notice("Connection failed");
                }
              } else {
                // TODO: is there really no way to extract all? I've failed to find a way to do it, but there surely has
                // to be a way. Episteme Reader managed to read out both the root level folders I have after linking
                // with DAVx5. But there's probably a backwards way to do it considering indexing `/` fails. Maybe
                // that's what the `.well-known` is for?
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
          + "synced when the rest of the vault isn't. This is only enabled and only takes effect when the "
          + "full vault sync setting is disabled."
        )
        .addText(text => {
          let el: HTMLInputElement = text
            .setPlaceholder("/webdav/share/path")
            .onChange(value => {
              newShare = value;
            })
            .inputEl;
          el.id = "webdav-subfolder-remote-path";
          el.pattern = '\\/(?:|[^\\/].*)';
          el.addClass("webdav-sync-validated");
        })
        .addText(text => {
          let el: HTMLInputElement = text.setPlaceholder("absolute/path/in/vault")
            .onChange(value => {
              newVaultFolder = value;
            })
            .inputEl;
          el.id = "webdav-subfolder-local-path";
          el.pattern = '[^\\/].*';
          el.addClass("webdav-sync-validated");
        })
        .addButton(button => {
          let btn = button.setButtonText("Add")
            .setCta()
            .onClick(async () => {
              if (newShare == null
                || newVaultFolder == null
                || newShare.length == 0
                || newVaultFolder.length == 0) {
                new Notice("You must supply both the webdav share and local folder");
                return;
              }
              let localShare = document.getElementById("webdav-subfolder-local-path") as HTMLInputElement;
              let remoteShare = document.getElementById("webdav-subfolder-remote-path") as HTMLInputElement;
              if (remoteShare.validity.patternMismatch) {
                new Notice(
                  "The WebDAV share must be in the form of an absolute path in the WebDAV server, for example /some/folder"
                );
                return;
              }
              if (localShare.validity.patternMismatch) {
                new Notice(
                  "The local folder must be in the form of a vault-relative path, for example some/vault/folder"
                );
                return;
              }

              this.plugin.settings.sync.subfolders[newVaultFolder] = {
                dest: newShare
              } as FolderDestination;
              await this.plugin.saveSettings()
              this.display();
            })
          btn.buttonEl.id = "webdav-sync-add-subvault-map-btn";
          btn.disabled = this.plugin.settings.sync.full_vault_sync;
          return btn;
        });
      containerEl.createDiv({
        attr: {
          id: "folder-mappings"
        }
      })
      this.regenerateFolderMappings();
    }
    new Setting(containerEl).setName("Meta").setHeading();

    let issueContainer = containerEl.createEl("p", {
      text: "Running into issues? Open an issue on "
    });
    issueContainer.createEl("a", {
      text: "GitHub",
      href: "https://github.com/LunarWatcher/obsidian-webdav-sync"
    });
    issueContainer.appendText(" or on ");
    issueContainer.createEl("a", {
      text: "Codeberg.",
      href: "https://codeberg.org/LunarWatcher/obsidian-webdav-sync"
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
