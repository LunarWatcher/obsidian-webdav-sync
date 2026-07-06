
/**
 * Status object associated with an individual item being synced.
 */
export interface ActionedItem {
  lastFile: String;
  lastProgress: number;
  // TODO: add ActionType?
}

/**
 * Status object associated with a completed sync.
 */
export interface SyncResult {
  actionedCount: number;
  actionedFolders: number;
  errorCount: number;
};

/**
 * The status object yielded by the sync generators, either corresponding to an in-progress sync, or a completed sync,
 * depending on the type of `result`.
 * SyncResult means the sync has completed, while ActionedItem is an intermediate that can be used to report ongoing 
 * progress to the end-user.
 */
export interface Status {
  result: SyncResult | ActionedItem;
};

export type AsyncStatusGenerator = () => AsyncGenerator<Status>;
export type AsyncProgressGenerator = () => AsyncGenerator<ActionedItem>;

