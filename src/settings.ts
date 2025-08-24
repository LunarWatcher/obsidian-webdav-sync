import {DAVServerConfig, DEFAULT_DAV_CONFIG} from "./fs/webdav";
import MyPlugin from "./main";
import { App, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_SYNC_SETTINGS, SyncSettings } from "./sync/sync_settings";

export interface settings_t {
  server_conf: DAVServerConfig;
  sync: SyncSettings,
}

export const DEFAULT_SETTINGS: settings_t = {
  server_conf: DEFAULT_DAV_CONFIG,
  sync: DEFAULT_SYNC_SETTINGS
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
    // Some other solutions seem to involve using react, but I'd sooner die than use react. It's already bad enough
    // that obsidian is Electron-based
    containerEl.insertAdjacentHTML("beforeend", "<h1>WebDAV Sync settings</h1>");
    { 
      containerEl.insertAdjacentHTML("beforeend", "<h2>Server connection settings</h2>");

      new Setting(containerEl)
        .setName('WebDAV URL')
        .setDesc('URL to your WebDAV share')
        .addText(text => text
          .setPlaceholder('https://dav.example.com')
          .setValue(this.plugin.settings.server_conf.url || "")
          .onChange(async (value) => {
            this.plugin.settings.server_conf.url = value;
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
    }
    {
      containerEl.insertAdjacentHTML("beforeend", "<h2>Sync settings</h2>");
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
    }
    containerEl.insertAdjacentHTML("beforeend", `<h2>Meta</h2>
    <p>Running into issues? Open an issue on <a href="https://github.com/LunarWatcher/obsidian-webdav-sync">GitHub</a>.</p>
    `);
  }

  
}
