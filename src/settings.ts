import {DAVServerConfig, DEFAULT_DAV_CONFIG} from "fs_webdav";
import MyPlugin from "main";
import { App, PluginSettingTab, Setting } from "obsidian";

export interface settings_t {
  server_conf: DAVServerConfig;
}

export const DEFAULT_SETTINGS: settings_t = {
  server_conf: DEFAULT_DAV_CONFIG,
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

    // TODO: use headers to create categories rather than this shit
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
}
