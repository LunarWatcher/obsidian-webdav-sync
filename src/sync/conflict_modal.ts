import { App, Modal } from "obsidian";
import { SyncDir } from "./syncdir";
import { ActionType } from "./actiontype";
import { FileData } from "./sync";

const CONFLICT_MODAL_SELECT_ACTION = "livi-webdav-sync-conflict-modal-action-picker";
export type ConflictResolver = (action: ActionType | null) => void;
export class ConflictModal extends Modal {
  fileName: string;
  direction: SyncDir;
  resolver: ConflictResolver;
  srcData: FileData;
  destData: FileData;

  hasYielded: boolean = false;

  constructor(
    app: App,
    fileName: string,
    direction: SyncDir,
    srcData: FileData,
    destData: FileData,
    resolver: ConflictResolver,
  ) {
    super(app)
    this.fileName = fileName;
    this.direction = direction;
    this.srcData = srcData;
    this.destData = destData;
    this.resolver = resolver;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl("h1", {
      text: `Conflict: File edited ${this.direction == SyncDir.DOWN ? "locally" : "remotely"}`
    });
    contentEl.createEl("p", {
      text: `The file ${this.fileName} has a conflict. The source file was edited on ${this.formatDate(this.srcData.lastModified)}, `
        + `and the destination file was edited on ${this.formatDate(this.destData.lastModified)}. What would you like to do?`
    });
    const dropdown = contentEl.createEl("select", {
      attr: {
        id: CONFLICT_MODAL_SELECT_ACTION
      },
      cls: ["livi-webdav-override"]
    });
    dropdown.createEl("option", {
      text: `Do nothing (to update, do a ${this.direction == SyncDir.DOWN ? "push" : "pull"} after this sync)`,
      value: "noop"
    });
    dropdown.createEl("option", {
      text: `Discard ${this.direction == SyncDir.DOWN ? "local" : "remote"} changes`,
      value: "add"
    });

    const btnWrapper = contentEl.createDiv({
      cls: ["livi-webdav-button-wrapper", "livi-webdav-flex"]
    });
    btnWrapper.createEl("button", {
      text: "OK",
    })
      .addEventListener(
        "click",
        this.yieldResult.bind(this)
      );
    btnWrapper.createEl("button", {
      text: "Abort sync",
    })
      .addEventListener(
        "click",
        this.abort.bind(this)
      );
  }

  formatDate(date: number | null): string {
    if (date == null) {
      return "???";
    }
    return new Date(date).toLocaleString()
  }

  yieldResult() {
    const diag = activeDocument.getElementById(CONFLICT_MODAL_SELECT_ACTION) as HTMLSelectElement;
    if (diag.value == null) {
      new Notification("Must select an action");
      return;
    }
    this.resolver(
      diag.value == "add" ? ActionType.ADD : ActionType.NOOP
    );
    this.hasYielded = true;
    this.close();
  }

  abort() {
    this.close();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.hasYielded) {
      this.resolver(null);
    }
  }
};
