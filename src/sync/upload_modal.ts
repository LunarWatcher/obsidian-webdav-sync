import {App, Modal} from "obsidian";

export class UploadModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.setText('*notices your sync plugin*');
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
