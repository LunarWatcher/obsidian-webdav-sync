import {Notice, Plugin} from 'obsidian';
import {DEFAULT_SETTINGS, settings_t, WebDAVSettingsTab} from 'settings';
import {Connection} from './fs/webdav';
import {FileProvider} from 'sync/files';
import {SyncImpl} from 'sync/sync_impl';
import {onActionError, showActionTaskGraph} from 'integration/actions';
import {SyncModal} from 'sync/sync_modal';

export default class WebDAVSyncPlugin extends Plugin {
  settings: settings_t;
  client: Connection | null;

  async onload() {
    await this.loadSettings();
    await this.initRibbon();
    await this.reloadClient();

    this.addSettingTab(new WebDAVSettingsTab(this.app, this));
    this.addCommand({
      id: "webdav-upload",
      name: "Upload to WebDAV",
      icon: "upload",
      // Fails to handle addCommand()'s signature being () => any
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      callback: this.uploadAction.bind(
        this,
        false
      ) 
    });
    this.addCommand({
      id: "webdav-download",
      name: "Download from WebDAV",
      icon: "download",
      // Fails to handle addCommand()'s signature being () => any
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      callback: this.downloadAction.bind(
        this,
        false
      )
    });
  }

  onunload() {

  }

  async uploadAction(dryRun: boolean) {
    await new SyncImpl(
      this,
      onActionError,
      showActionTaskGraph,
      () => {},
      dryRun,
      false
    ).upload();
  }

  async downloadAction(dryRun: boolean) {
    await new SyncImpl(
      this,
      onActionError,
      showActionTaskGraph,
      () => {},
      dryRun,
      false
    ).download();
  }

  async initRibbon() {
    const ribbonIconEl = this.addRibbonIcon('cloud', 'Open WebDAV sync panel', (evt: MouseEvent) => {
      if (this.client == null) {
        new Notice("You don't appear to have set up the plugin. Go to settings before continuing.");
        return;
      }
      new SyncModal(this.app, this).open();
    });
    ribbonIconEl.id = "webdav-ribbon-btn"

  }

  /**
   * Utility function used by some of the integration tests.
   * Should never be used anywhere else in code, and ANY type changes to this method must result in unit test changes.
   */
  _getFileInterface() {
    return new FileProvider(
      this
    )
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<settings_t>);
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
          this.app,
          this.settings.server_conf
        )
      } catch (ex) {
        console.error(ex);
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/message
        // If something else is thrown it'll be undefined or weird, and I do not care
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access 
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
