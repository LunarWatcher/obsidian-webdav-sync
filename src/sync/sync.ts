export interface FileData {
  lastModified: number | null;
};

export interface SyncResult {
  actionedCount: number;
  errorCount: number;
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

export function actionToDescriptiveString(action: ActionType): string {
  switch (action) {
  case ActionType.ADD:
    return "Add or update";
  case ActionType.REMOVE:
    return "Remove";
  case ActionType.ADD_LOCAL:
    return "Conflict identified; ask user";
  case ActionType.NOOP:
    return "No changes made";
  }
}

export type Path = string;
export type Files = Map<Path, FileData>;
export type Actions = Map<Path, ActionType>;

export enum SyncDir {
  UP,
  DOWN
};

/**
 * Utility function that turns millisecond timestamps into second timestamps. 
 * The division is floored. This helps avoid floating point inaccuracies between
 * the local filesystem and remote filesystem.
 */
function dateRounder(a: number | null): number {
  if (a == null) return 0;
  return Math.floor(a / 1000);
}

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

      if (remoteData.lastModified == null || data.lastModified == null) {
        // If either of the dates are null, the underlying filesystem or remote webdav server doesn't support
        // it/has it disabled. We need to add just in case.
        out.set(file, ActionType.ADD);
        continue;
      }

      if (dateRounder(remoteData.lastModified) == dateRounder(data.lastModified)) {
        if (includeNoop) {
          out.set(file, ActionType.NOOP);
        }
      } else if (dateRounder(remoteData.lastModified) > dateRounder(data.lastModified)) {
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

/**
 * General template for the sync system, since it's the same shit in both places with some minor differences
 *
 * @param direction   The sync direction; used for some actions that require knowing whether the source is local
 *                    or not
 * @param sourceFiles The files in the source directory. Does not have to be local
 * @param destFiles   The files in the destination directory. Does not have to be remote.
 * @param onError     invoked on error. What did you expect?
 * @param onUpdate    Called when an update is made; used to perform the specific action on the source or dest files
 *                    with the corresponding adapter
 * @param onConflict  Called when a conflict happens. In production, this just shows a dialog to the user. In unit tests,
 *                    it's a noop or an otherwise fixed result.
 */
export async function runSync(
  direction: SyncDir,
  sourceFiles: Files,
  destFiles: Files,
  actions: Actions,
  onError: (message: string) => void,
  onUpdate: (
    type: ActionType,
    path: string,
    localData: FileData,
    remoteData: FileData
  ) => Promise<string | null>,
  onConflict: (path: string, src: FileData, dest: FileData, direction: SyncDir) => Promise<ActionType>,
): Promise<SyncResult> {
  let actionedCount = 0;
  let errorCount = 0;
  for (let [file, action] of actions) {
    let srcData = sourceFiles.get(file) as FileData;
    let destData = destFiles.get(file) as FileData;

    if (srcData == null) {
      onError("Fatal: " + file + " lacks srcData");
      console.error(sourceFiles);
      return {
        actionedCount: -1,
        errorCount: errorCount + 1
      };
    } else if (typeof(file) != "string") {
      onError("Fatal: expected string, found " + file);
      console.error(sourceFiles);
      return {
        actionedCount: -1,
        errorCount: errorCount + 1
      };
    }
    // ADD_LOCAL needs to be first, so we don't have to redo value checks for action
    // TODO: this cannot be here, and needs to be refactored out. The conflict resolution
    // needs to take place before anything else happens so it can be done in bulk with 
    // obsidian's clunky input stuff.
    // Hijacking the dry run stuff with input fields might be an idea as well
    if (action == ActionType.ADD_LOCAL) {
      action = await onConflict(
        file,
        srcData,
        destData,
        direction
      );
    }

    if (action == ActionType.NOOP) {
      continue; 
    } else {
      try {
        onUpdate(
          action,
          file,
          srcData,
          destData
        );
        actionedCount += 1;
      } catch (ex) {
        // TODO: would be nice if this could be done atomically, but that feels involved.
        // Especially remotely. But I'm pretty sure there's move functions in the client,
        // so might be relatively easy
        console.log(ex);
        errorCount += 1;
        if (ex instanceof Error) {
          onError(ex.message);
        } else {
          onError("An unknown error occurred");
        }
      }
    }
  }
  return {
    actionedCount,
    errorCount,
  }
}
