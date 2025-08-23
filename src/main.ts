import {Connection} from 'fs_webdav';
import { App, Editor, MarkdownView, Modal, Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, settings_t, WebDAVSettingsTab } from 'settings';

export default class MyPlugin extends Plugin {
  settings: settings_t;
  client: Connection | null;

  async onload() {
    await this.loadSettings();
    await this.initRibbon();
    if (this.settings.server_conf.url == null) {
      new Notice(
        "WebDAV sync: missing URL. Add one in the plugin settings, or disable this plugin",
        // The default duration is too short
        30000
      );
    } else {
      try {
        this.client = new Connection(
          this.settings.server_conf
        )
      } catch (ex) {
        console.error(ex);
        new Notice(`Failed to connect to WebDAV server: ${ex.message} - have you run setup yet?`);
      }
    }

    this.addSettingTab(new WebDAVSettingsTab(this.app, this));

  }

  onunload() {

  }

  async initRibbon() {
    const ribbonIconEl = this.addRibbonIcon('upload', 'Open sync settings', (evt: MouseEvent) => {
      new Notice('This is a notice!');
    });

  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class SampleModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const {contentEl} = this;
    contentEl.setText('Woah!');
  }

  onClose() {
    const {contentEl} = this;
    contentEl.empty();
  }
}
