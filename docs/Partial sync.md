# Partial sync

One of the main features of this plugin is the ability to do partial sync of folders. This only takes place if full vault sync is disabled; at the time of writing, there's no way to both sync the full vault, and source certain folders from other locations. Support for this is planend in the future, as ignoring folders is a whole thing.

The idea behind partial sync is to enable syncing specific folders from a vault, while fully blocking access to the rest. This is not technically exclusively a feature of the plugin, but a feature that's a combination of WebDAV server access restrictions, and the plugin itself.

## Server-sided auth

If you're looking for a more concrete example of this, see [the instructions for Copyparty](webdav-servers/Copyparty.md).

Consider Obsidian's built-in sync plugin, or Syncthing's `.stignore`. Most of the plugins I've looked at have a variant of this; give the plugin full access to all your files, disable sharing the files you don't want. But in both these cases, nothing technically prevents access to the rest of the vault. This could be due to a bug, it could be due to misconfiguration, or too losely defined rules.

The end-result is notes being synced where they shouldn't be. For my use-case, this is a problem just when it's unintentional, and much more so in the event of a compromised computer.

Partial folder sync in this plugin is a special kind of sync if combined with the right server settings. Through the power of using two accounts instead of one, provided your WebDAV server supports shadowed permissions, you can grant a secondary account read permissions only to subfolders.

For example, given two accounts (`secure`, `insecure`):

* `/vault` (read-write: secure, deny: insecure)
    * `/vault/Partially synced subfolder` (read-write: secure, insecure)

As long as your DAV server can be configured with permissions this granular, you can fully prevent access to the rest of the vault, while only exposing one folder. This can be set up much more broadly as well. There's nothing preventing you from only giving read permissions to some users, or giving additional users access to specific folders.

> [!warning]
>
> There's currently no way to specify that a partially synced folder is read-only. If you try to push to it, it will result in failures. With some servers (like copyparty), the default security settings will then ban your IP for some period of time. 
>
> Read-only folder support is planned.

To avoid that folder being an entire standalone vault, it then has to be added as a subfolder to the current vault. That is the feature this plugin supports:

![Screenshot showing a folder mapping added for the local folder Tech, mapped to the WebDAV share /livi/obsidian/Tech](assets/folder mapping example.png)

When doing it this way, the `Tech` folder appears structurally identical in both vaults. This is important for reasons described in the next section.

## Obsidian quirks, and partial sync pitfalls

This kind of sync does have some problems, and they're only solvable through policy. 

When you partially sync a folder, there's no way to tell what dependencies it has outside the folder. This means that if your partial folder contains a link to a part of your main vault that isn't involved in the partial sync, the content will not be included nor accessible from the partially synced vault. 

You're free to decide whether or not you think this is a problem, and what you want to do about it. For reference, this is my policy on folders that get partially synced:

1. The folder must be self-contained, and cannot link _to_ other folders in the vault. It can _be_ linked _from_ other folders, but not the other way around.
2. In "Files and links", images are set to "In subfolder under current folder", with the folder set to `_images`. 
    * Though any image storing method relative to the files work, images must be within the partially synced tree for them to be included.

I also have a content policy that states only information that could be public can go in that folder. If it can't (or shouldn't), it must be in a non-partial folder.

[This post on the obsidian forum](https://forum.obsidian.md/t/nested-vaults-usage-and-risks/6360) is also very applicable here, and I strongly suggest reading through it. Partial sync is very much within an edge-case area of Obsidian.

Theoretically, subfolder sync is compatible with nested vaults, as the sync process mostly does not care what kind of files it syncs. Do note that due to intentional design, the toggle that ignores workspace files does not work with fully nested vaults with their own `.obsidian`-folders.
