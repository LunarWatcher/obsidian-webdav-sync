# Config folder sync

By default, full vault sync includes the config folder (typically `.obsidian`). An option to ignore the config folder exists (Settings - WebDAV sync - Sync - Ignore config folder), and can be enabled to stop syncing the config folder.

When the option to ignore the config folder is enabled, the config folder is ignored in its entirety. It's not synced, but it's also not treated as deleted in the remote. This means you can have the option set differently on different devices depending on what you want the central config folder to be (or not be if you want it disabled everywhere). If you want it disabled everywhere and also not exist in the WebDAV share, you need to delete it manually.

If not syncing the config folder, note that there are a few caveats. Specifically, behaviour is undefined if your remote vault and local settings define two different config folders. The sync assumes your config folder is static between all copies of the config folder. If it varies, it'll be synced and be noop locally.
