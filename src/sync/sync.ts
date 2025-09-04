export interface FileData {
  lastModified: number | null;
};

export interface SyncResult {
  actionedCount: number;
  actionedFolders: number;
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
    return "Conflict identified; ask user [not implemented, falls back to adding or updating instead]";
  case ActionType.NOOP:
    return "No changes made";
  }
}

export type Path = string;
export type Files = Map<Path, FileData>;
export type Actions = Map<Path, ActionType>;
export interface Folder {
  realPath: string;
  commonPath: string;
}
export interface Content {
  files: Files;
  folderPaths: Folder[];
}

export type OnUpdateCallback = (
  type: ActionType,
  path: string,
  localData: FileData | undefined,
  remoteData: FileData | undefined
) => Promise<void>;

export type OnConflictCallback = (
  path: string,
  src: FileData | undefined,
  dest: FileData | undefined,
  direction: SyncDir
) => Promise<ActionType>;

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

// TODO: this did not solve the underlying problem. For some reason, android 
// always forces sync of some (but not all) .obsidian/ folders, in spite of the
// timestamps appearing identical. 
// I still suspect there's rounding issues at play, but it's not within 1 second,
// and 1s is already too high for comfort
// The probability this'll result in issues is extremely low.
function approx(a: number, b: number): boolean {
  return a == b
    || Math.abs(a - b) <= 1;
}

/**
 * Calculates the sync changes to do.
 *
 * The function is pseudo-bidirectional, and attempts to do a merge
 */
export function calculateSyncActions(
  src: Files,
  dest: Files,
  includeNoop: boolean = false,
  deleteIsNoop: boolean = false
): Actions {
  const out: Actions = new Map<string, ActionType>();

  for (let [file, _] of dest) {
    // Deletions are determined by finding files available in the remote that aren't available locally. These are deleted
    // in the destination.
    if (!src.has(file)) {
      if (deleteIsNoop && includeNoop) {
        out.set(
          file,
          ActionType.NOOP
        );
      } else if (!deleteIsNoop){
        out.set(
          file,
          ActionType.REMOVE
        );
      }
    }
  }

  for (let [file, data] of src) {
    if (!dest.has(file)) {
      // File available locally but not remotely: push.
      out.set(file, ActionType.ADD);
    } else {
      // Check the dates
      let remoteData = dest.get(file) as FileData;
      if (remoteData.lastModified == null || data.lastModified == null) {
        // If either of the dates are null, the underlying filesystem or remote webdav server doesn't support
        // it/has it disabled. We need to add just in case.
        out.set(file, ActionType.ADD);
        continue;
      }

      if (approx(dateRounder(remoteData.lastModified), dateRounder(data.lastModified))) {
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
 * Calculates folder actions. These are done separately from files really just for readability purposes.
 * Unlike file s ync, folder operations only have one action; remove. 
 * Folders are never added nor conflict checked, as this functionality is derived from sync. If a folder
 * appeared in the remote with no content on a push, we don't care because it has no content. 
 * If it _has_ content, that is (will be) caught by ADD_LOCAL in _file_ sync.
 *
 * Folders are automatically created by both WebDAV and obsidian's adapter API, so no explicit folder
 * actions ever need to be taken except for deleting stale folders
 */
export function findDeletedFolders(
  src: Folder[],
  dest: Folder[]
): Folder[] {
  let deleted = [];
  // TODO: this is nasty. There has to be a better way
  // (Maybe do a Set() instead?)
  for (let destFolder of dest) {
    // We only care about the commonPath, because it's the same path in both.
    // realPath varies between the two, so it'll fail to match subfolder sync if that's used.
    if (!src.some(srcFolder =>
      destFolder.commonPath == srcFolder.commonPath
    )) {
      deleted.push(destFolder);
    }
  }

  // Required for nested deletions to be correct
  // Basically, we want the return list to be 
  //     ["a/b/c", "a/b", "a"]
  // Since the inverse or a random order causes problems both if recursive folder deletion is available, and if it isn't
  //
  // Given ["a", "a/b", "a/b/c"]:
  // * If it is available: "a" is deleted, the remaining two fail.
  //   However, since the tree is deleted, no additional tries are required, but it does cause misleading error messages
  // * If it isn't available: "a" cannot be deleted and generates an error. Same for a/b, but a/b/c is deleted.
  //   The next run, the list is only ["a", "a/b"], so "a" fails, "a/b" succeeds.
  //   In this case, three runs total are required for the folder hierarchy to be deleted.
  deleted.sort((a, b) => b.commonPath.length - a.commonPath.length);

  return deleted;
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
  source: Content,
  dest: Content,
  actions: Actions,
  onError: (message: string) => void,
  onUpdate: OnUpdateCallback,
  onConflict: OnConflictCallback,
  deleteIsNoop: boolean
): Promise<SyncResult> {
  let actionedCount = 0;
  let errorCount = 0;
  for (let [file, action] of actions) {
    let srcData = source.files.get(file);
    let destData = dest.files.get(file);

    if (
      srcData == null
      && action != ActionType.REMOVE // Removing is obviously going to lack srcData
    ) {
      onError("Fatal: " + file + " lacks srcData");
      console.error(file, action, srcData, destData, direction);
      return {
        actionedCount: -1,
        actionedFolders: -1,
        errorCount: errorCount + 1
      };
    } else if (typeof(file) != "string") {
      onError("Fatal: expected string, found " + file);
      console.error(source);
      return {
        actionedCount: -1,
        actionedFolders: -1,
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
        await onUpdate(
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

  let actionedFolders = 0;
  if (!deleteIsNoop) {
    const foldersToDelete = findDeletedFolders(
      source.folderPaths,
      dest.folderPaths
    );

    console.log(source.folderPaths);
    console.log(dest.folderPaths);
    console.log(foldersToDelete);

    for (const folder of foldersToDelete) {
      try {
        await onUpdate(
          ActionType.REMOVE,
          folder.commonPath,
          undefined,
          undefined
        );
        console.log(folder.commonPath);
        actionedFolders += 1;
      } catch (ex) {
        // TODO: would be nice if this could be done atomically, but that feels involved.
        // Especially remotely. But I'm pretty sure there's move functions in the client,
        // so might be relatively easy
        console.log(ex);
        errorCount += 1;
        if (ex instanceof Error) {
          onError(ex.message + " --- path: " + folder);
        } else {
          onError("An unknown error occurred");
        }
      }
    }
  }

  return {
    actionedCount,
    actionedFolders,
    errorCount,
  }
}
