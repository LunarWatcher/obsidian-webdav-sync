import {Notice, Plugin} from 'obsidian';
import {DEFAULT_SETTINGS, settings_t, WebDAVSettingsTab} from 'settings';
import {Connection} from './fs/webdav';
import {UploadModal} from './sync/upload_modal';

export default class MyPlugin extends Plugin {
  settings: settings_t;
  client: Connection | null;

  async onload() {
    await this.loadSettings();
    await this.initRibbon();
    await this.reloadClient();

    this.addSettingTab(new WebDAVSettingsTab(this.app, this));

  }

  onunload() {

  }

  async initRibbon() {
    const ribbonIconEl = this.addRibbonIcon('cloud', 'Open WebDAV sync panel', (evt: MouseEvent) => {
      if (this.client == null) {
        new Notice("You don't appear to have set up the plugin. Go to settings before continuing.");
        return;
      }
      new UploadModal(this.app, this).open();
    });
    ribbonIconEl.id = "webdav-ribbon-btn"

  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Reloads the underlying webdav client.
   * This needs to be called at some point if changes are made to the client settings so
   * the new settings take hold.
   */
  async reloadClient(): Promise<boolean> {
    // The reset is noop at startup
    this.client = null;
    if (!this.settings.server_conf.url) {
      new Notice(
        "WebDAV sync: missing URL. Add one in the plugin settings, or disable this plugin",
        // The default duration is too short
        30000
      );
      return false;
    } else {
      try {
        this.client = new Connection(
          this.settings.server_conf
        )
      } catch (ex) {
        console.error(ex);
        new Notice(`Failed to connect to WebDAV server: ${ex.message} - have you run setup yet?`);
        return false;
      }
    }
    return true;
  }

  adapter() {
    return this.app.vault.adapter;
  }

  configDir() {
    return this.app.vault.configDir;
  }
}
