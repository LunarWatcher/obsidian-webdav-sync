export interface FolderDestination {
  dest: string;
};

export interface SubfolderMap {
  [vaultFolder: string]: FolderDestination;
};

export interface SyncSettings {
  full_vault_sync: boolean;
  root_folder: FolderDestination;
  // Thanks, typescript. You're super good at making types reliable
  subfolders: SubfolderMap;
  ignore_workspace: boolean;
  ignore_config_folder: boolean;
};

export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  full_vault_sync: true,
  root_folder: {
    dest: ""
  },
  subfolders: {},
  ignore_workspace: true,
  ignore_config_folder: false,
};
