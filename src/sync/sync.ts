export interface FileData {
  lastModified: number;
};

export enum ActionType {
  ADD,
  REMOVE,
  /**
   * Used for files that have changed remotely. This should result in a notification to the user before 
   * actually making changes, just in case it's wrong. 
   */
  ADD_LOCAL,
  NOOP
};

export type Path = string;
export type Files = Map<Path, FileData>;
export type Actions = Map<Path, ActionType>;


/**
 * Calculates the sync changes to do.
 *
 * The function is pseudo-bidirectional, and attempts to do a merge
 */
export function calculateSyncActions(
  src: Files,
  dest: Files,
  includeNoop: boolean = false
): Actions {
  const out: Actions = new Map<string, ActionType>();

  for (let [file, _] of dest) {
    // Deletions are determined by finding files available in the remote that aren't available locally. These are deleted
    // in the destination.
    if (!src.has(file)) {
      out.set(file, ActionType.REMOVE);
    }
  }

  for (let [file, data] of src) {
    if (!dest.has(file)) {
      // File available locally but not remotely: push.
      out.set(file, ActionType.ADD);
    } else {
      // Check the dates
      let remoteData = dest.get(file);
      if (remoteData == undefined) {
        // This should never trigger, but tsserver is a whiny cunt if it isn't checked, sooo
        throw Error("wtf typescript");
      }

      if (remoteData.lastModified == data.lastModified) {
        if (includeNoop) {
          out.set(file, ActionType.NOOP);
        }
      } else if (remoteData.lastModified > data.lastModified) {
        // remote is newer; likely forgotten pull. ADD_LOCAL gives an option of which to pick
        out.set(file, ActionType.ADD_LOCAL);
      } else {
        // local file is newer than the remote file; add it.
        out.set(file, ActionType.ADD);
      }
    }
  }

  return out;
}
