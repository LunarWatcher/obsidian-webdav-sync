import {DAVServerConfig, DEFAULT_DAV_CONFIG} from "./fs/webdav";
import MyPlugin from "./main";
import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_SYNC_SETTINGS, FolderDestination, SyncSettings } from "./sync/sync_settings";

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
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const {containerEl} = this;

    containerEl.empty();
    // TODO: Obsidian's documentation claims
    //    new Setting(containerEl).setText("Whatever").setHeading()
    // should work. Weirdly, `setText` does not seem to exist. Using `addText` does not work; this just sets the value.
    // Using `setName` does not work either. The method doesn't exist here either:
    //    https://docs.obsidian.md/Reference/TypeScript+API/Setting#Methods
    //
    // Granted, obsidian's API documentation is absolute horseshit. It's incredibly disappointing that it's this bad
    // when the editor itself being customisable is, y'know, one of their big things:tm:.
    // The setHeading() function is not helpful either. The documentation just says it returns `this`, and nothing else.
    // It would be nice if this was an option rather than having to presumably parse an HTML string in JS before 
    // inserting it.
    //
    // Future me update: while scrolling through plugin addition requests to see how much of a pain in the ass this is
    // going to be, https://github.com/obsidianmd/obsidian-releases/pull/5839#issuecomment-2978834437 says to use
    // setName instead of setText, but this still just creates a div, not an <h1>.
    // QuickAdd, another plugin that does have a proper header, uses createEl, which also appears to be forced in
    // the review process.
    containerEl.createEl("h1", {
      text: "WebDAV sync settings",
    });
    { 
      containerEl.createEl("h2", {
        text: "Server connection settings",
      });

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
        .setDesc('The password to use for authentication (warning: will be stored in plain text)')
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
              new Notice("Connected!");
            }
          })
        );
    }
    {
      containerEl.createEl("h2", {
        text: "Sync settings"
      });
      new Setting(containerEl)
        .setName("Full vault sync")
        .setDesc("Whether or not to sync the full vault")
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
            this.plugin.reloadClient();
            if (this.plugin.client != null) {
              const client = this.plugin.client.client;
              if (this.plugin.settings.sync.root_folder.dest != "") {
                try {
                  // I hate typescript so fucking much
                  let contents = client.getDirectoryContents(this.plugin.settings.sync.root_folder.dest) as any;
                  // TODO: tsserver whines about the .length because one of the two doesn't have length
                  // (the array has .length, the other appears to have .size()). Figure out if this will ever
                  // be returned
                  new Notice(
                    `Connection succeeded. Found folder with ${(await contents).length} direct files and folders.`
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
    containerEl.createEl("h2", {
      text: "Meta"
    })
    // Forced insertAdjacentHTML: createEl has no nested HTML support, I need a link, and I'm not doing that by hand
    containerEl.insertAdjacentHTML(
      "beforeend",
      '<p>Running into issues? Open an issue on <a href="https://github.com/LunarWatcher/obsidian-webdav-sync">GitHub</a></p>'
    );
    containerEl.createEl("p", {
      text: "Trans rights are human rights 🏳️‍⚧️ 🏳️‍🌈"
    })
  }

  regenerateFolderMappings() {
    const container = document.getElementById("folder-mappings") as HTMLDivElement;
    container.empty();

    // Fuck you javascript, why can I not `of` a dict?
    for (const path in this.plugin.settings.sync.subfolders) {
      // Typescript: are you fucking stupid?
      const dest = this.plugin.settings.sync.subfolders[path] as FolderDestination;

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
