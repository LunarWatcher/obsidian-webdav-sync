import {Notice} from "obsidian";
import {Actions} from "sync/sync";
import {DryRunInfo} from "sync/sync_impl";

export function onActionError(message: string) {
  new Notice(message);
}

export function showActionTaskGraph(
  actions: Actions, info: DryRunInfo
) {
  new Notice("IOU 1x dry run action. Use the modal instead");
}

