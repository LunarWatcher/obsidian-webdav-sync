# Conflict resolution

> [!note]
>
> New in 0.6.0

The plugin supports extremely basic conflict resolution at a file level. This is the highest planned resolution.

## When conflict resolution takes effect

Deletion is one of the hardest problems in sync, and as such, things that appear as deletions will never trigger a conflict resolution. This includes adding new files and then doing a pull - from the plugin's perspective, it isn't possible to tell if the file you just added was just added recently, or if it was then removed remotely. Therefore, even though this is technically a conflict, it counts as a removal and not a conflict. To deal with these conflicts, use the toggle to not delete anything in the sync modal.

A conflict counts as whne a file has an edit in the destination that is newer than the source.

* If you're pushing: the remote has a file with a last modified date later than your corresponding local file
* If you're pulling: your local vault has a file with a last modified date later  than the corresponding remote file

## What happens when a conflict is identified

When a conflict is identified, you'll get a popup that asks you what to do. It'll contain information about the file, the dates they were modified in the source and destination, and three possible actions:

* Do nothing: self-explanatory. The file is not updated anywhere.
* Discard remote or local changes: the place you're copying from (your vault if pushing, or your WebDAV server if pulling) takes precedence and overrides the destination (your WebDAV server if pushing, or your local vault if pulling)
  * This may result in data loss if you aren't actually sure what you're discarding. Auditing the file's state on your server is a good idea.
* Abort (dedicated button) - also triggers if you close the conflict modal

Note that an aborted sync does not revert the state of the files that did successfully sync prior to the conflicting files. WebDAV does not offer atomic syncs, and this plugin does not try to simulate one.

