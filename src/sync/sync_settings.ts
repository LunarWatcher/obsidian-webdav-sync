export interface FolderDestination {
  dest: string;
};

export interface SyncSettings {
  full_vault_sync: boolean;
  root_folder: FolderDestination;
  subfolders: Record<string, FolderDestination>;
};

export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  full_vault_sync: true,
  root_folder: {
    dest: ""
  },
  subfolders: {},
};
