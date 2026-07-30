import {DAVServerConfig, DEFAULT_DAV_CONFIG} from "./fs/webdav";
import WebDAVSyncPlugin from "./main";
import { App, Notice, PluginSettingTab, SecretComponent, Setting, SettingDefinitionItem, SettingGroupItem } from "obsidian";
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

// Copied from https://docs.obsidian.md/Plugins/User+interface/Settings
function getPath(obj: Record<string, unknown>, path: string): unknown {
  let cursor: unknown = obj;
  for (let part of path.split('.')) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

// Copied from https://docs.obsidian.md/Plugins/User+interface/Settings
function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  let parts = path.split('.');
  let last = parts.pop()!;
  let cursor: Record<string, unknown> = obj;
  for (let part of parts) {
    let next = cursor[part];
    if (next === null || typeof next !== 'object') {
      next = {};
      cursor[part] = next;
    }
    cursor = next as Record<string, unknown>;
  }
  cursor[last] = value;
}

export class WebDAVSettingsTab extends PluginSettingTab {
  plugin: WebDAVSyncPlugin;

  constructor(app: App, plugin: WebDAVSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  newShare: string = "";
  newVaultFolder: string = "";
  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: "Help",
        desc: "For more help, see the ",
        render: (elem) => {
          elem.descEl
            .createEl("a", {
              text: "documentation.",
              href: "https://lunarwatcher.github.io/obsidian-webdav-sync/"
            })
        }
      },
      {
        name: "WebDAV URL",
        desc: "URL to your WebDAV server",
        control: {
          type: "text",
          placeholder: "https://dav.example.com",
          key: "server_conf.url",
        }
      },
      {
        name: "WebDAV username",
        desc: "The username to use for authentication",
        control: {
          type: "text",
          placeholder: "LunarWatcher",
          key: "server_conf.username"
        }
      },
      {
        name: "WebDAV password",
        desc: "The password to use for authentication",
        render: el => {
          el.addComponent(el => new SecretComponent(this.app, el)
            .setValue(this.plugin.settings.server_conf.password || "")
            .onChange(async (value) => {
              this.plugin.settings.server_conf.password = value;
              await this.plugin.saveSettings();
            })
          )
        }
      },
      {
        type: "group",
        heading: "Sync",
        items: [
          {
            name: "Full vault sync",
            desc: "Whether or not to sync the full vault. This option is mutually exclusive with partial vault sync, and "
              + "must be disabled for folder mappings to take effect.",
            control: {
              type: "toggle",
              key: "sync.full_vault_sync",
            }
          },
          {
            name: "Ignore workspace files",
            desc: "Whether or not to sync workspace.json and workspace-mobile.json. Leaving this off is strongly encouraged. "
              + "The workspace files contain some information about editor state. As such, it's highly prone to "
              + "conflicts, because any change in the layout will also update these files. "
              + "There's no consequences for turning it beyond needing to decide which to keep at a potentially "
              + "higher rate, as simply opening files in obsidian is enough to cause conflicts.",
            control: {
              type: "toggle",
              key: "sync.ignore_workspace"
            }
          },
          {
            name: "Ignore config folder",
            desc: "Whether or not to ignore the config folder (typically .obsidian). Mainly useful if you want to fully "
              + "separate the workspaces, and only sync the content. Note that this means you'll need to manually "
              + "install the sync plugin for other clients to be able to sync. This option will fully exclude the "
              + "config folder, so if you've previously uploaded it, you'll need to manually delete it if you want "
              + "it gone. This means the option to sync or not is fully device-local",
            control: {
              type: "toggle",
              key: "sync.ignore_config_folder"
            }
          },
          {
            name: "WebDAV share for the full vault",
            desc: "Where to sync the full vault to. This is a path relative to the WebDAV server, and must not include "
              + "a full URL. Example of a legal value: /livi/obsidian",
            render: (el) => {
              el.addText(text => {
                let el = text.setPlaceholder("/livi/obsidian")
                  .setValue(this.plugin.settings.sync.root_folder.dest)
                  .onChange(async (value) => {
                    let el = activeDocument.getElementById("livi-webdav-sync-full-vault-path") as HTMLInputElement;
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

                el.id = "livi-webdav-sync-full-vault-path";
                el.pattern = '\\/(?:|[^\\/].*)'
                el.addClass("livi-webdav-sync-validated");
              })
              el.addButton(button => button
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
                }).buttonEl.id = "livi-webdav-settings-test-connection"
              );
            },
          },
          {
            name: "Folder mapping",
            desc: "Used to add sub-maps of the obsidian vault, meaning a specific subfolder that's "
              + "synced when the rest of the vault isn't. This is only enabled and only takes effect when the "
              + "full vault sync setting is disabled.",
            render: (el) => {
              el.addText(text => {
                let el: HTMLInputElement = text
                  .setPlaceholder("/webdav/share/path")
                  .onChange(value => {
                    this.newShare = value;
                  })
                  .inputEl;
                el.id = "livi-webdav-subfolder-remote-path";
                el.pattern = '\\/(?:|[^\\/].*)';
                el.addClass("livi-webdav-sync-validated");
              })
                .addText(text => {
                  let el: HTMLInputElement = text.setPlaceholder("absolute/path/in/vault")
                    .onChange(value => {
                      this.newVaultFolder = value;
                    })
                    .inputEl;
                  el.id = "livi-webdav-subfolder-local-path";
                  el.pattern = '[^\\/].*';
                  el.addClass("livi-webdav-sync-validated");
                })
                .addButton(button => {
                  let btn = button.setButtonText("Add")
                    .setCta()
                    .onClick(async () => {
                      if (this.newShare == null
                        || this.newVaultFolder == null
                        || this.newShare.length == 0
                        || this.newVaultFolder.length == 0) {
                        new Notice("You must supply both the webdav share and local folder");
                        return;
                      }
                      let localShare = activeDocument.getElementById("livi-webdav-subfolder-local-path") as HTMLInputElement;
                      let remoteShare = activeDocument.getElementById("livi-webdav-subfolder-remote-path") as HTMLInputElement;
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

                      this.plugin.settings.sync.subfolders[this.newVaultFolder] = {
                        dest: this.newShare
                      };
                      await this.plugin.saveSettings()
                      this.update()
                    })
                  btn.buttonEl.id = "livi-webdav-sync-add-subvault-map-btn";
                  btn.disabled = this.plugin.settings.sync.full_vault_sync;
                  return btn;
                });
            }
          },
          ...this.regenerateFolderMappings()
        ]
      },
      {
        type: "group",
        heading: "Meta",
        items: [
          {
            name: "Documentation",
            render: (el) => {
              el.settingEl.style = "flex-direction: column;"
              let issueContainer = el.settingEl.createEl("p", {
                text: "Need more information? See the "
              });
              issueContainer.createEl("a", {
                text: "documentation",
                href: "https://lunarwatcher.github.io/obsidian-webdav-sync"
              });
            }
          },
          {
            name: "Help",
            render: (el) => {
              el.settingEl.style = "flex-direction: column;"
              let issueContainer = el.settingEl.createEl("p", {
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
              el.settingEl.createEl("p", {
                text: "Trans rights are human rights 🏳️‍⚧️ 🏳️‍🌈"
              })
            }
          },
        ]
      }
    ];
  }

  getControlValue(key: string): unknown {
    return getPath(
      this.plugin.settings as unknown as Record<string, unknown>,
      key
    );
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    setPath(
      this.plugin.settings as unknown as Record<string, unknown>,
      key,
      value
    );
    await this.plugin.saveData(this.plugin.settings);
    await this.plugin.reloadClient();
    this.update()
  }

  display(): void {
    const {containerEl} = this;

    new Setting(containerEl).setName("Meta").setHeading();

  }

  regenerateFolderMappings(): SettingGroupItem<string>[] {

    const out: SettingGroupItem<string>[] = [];
    // Fuck you javascript, why can I not `of` a dict?
    for (const path in this.plugin.settings.sync.subfolders) {
      const dest = this.plugin.settings.sync.subfolders[path];

      out.push({
        name: `WebDAV target folder for vault path: ${path}`,
        render: (el) => {
          el.addText(text => {
            text.setValue(dest.dest)
              .onChange(async (value) => {
                const lastDest = this.plugin.settings.sync.subfolders[path] as FolderDestination | null;
                if (lastDest?.dest.startsWith("/")) {
                  lastDest.dest = value;

                  this.plugin.settings.sync.subfolders[path] = lastDest;
                  await this.plugin.saveSettings()
                }
              })
          }).addButton(button =>
            button
              .setIcon("trash")
              .setDestructive()
              .setCta()
              .onClick(async () => {
                delete this.plugin.settings.sync.subfolders[path];
                await this.plugin.saveSettings();
                this.update();
              })
          )
        }
      })
    }

    return out
  }
  
}
