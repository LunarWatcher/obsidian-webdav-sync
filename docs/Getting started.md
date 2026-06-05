# Getting started

This guide assumes you've already installed the plugin. If you haven't, see [installing the plugin](/#installing-the-plugin)

{{ page.table_of_contents }}

> [!caution]
> Do not use 0.4.0 or earlier. These versions use an old plugin ID that was yoinked by another plugin by the same name submitted 6 months after this plugin. See [#25](https://github.com/LunarWatcher/obsidian-webdav-sync/issues/25) (GitHub) or [the changelog](https://codeberg.org/LunarWatcher/obsidian-webdav-sync/src/branch/master/CHANGELOG.md#0.5.0) for more information, and migration steps if you currently use 0.4.0 or older.

## Words of warning

The plugin is designed to minimise risk during normal operation. No automatic sync means that every device you have acts as a separate backup of the vault, so even if something goes wrong, you have a path to recovery.

However, during setup, there are a few failure points that the plugin hasn't been configured to protect you from. Worst-case, you wipe your vault.

The plan eventually is to outright (and without the ability to bypass) block the ability to do a full wipe on pull, but  this is not yet implemented. During plugin setup, you _need_ to read the docs before you do anything, as going for "download" without first pushing your vault will wipe your vault locally.

For good measure, I suggest taking a backup before first-time use. If all you have is one copy of the vault, user error can and will destroy it irrecoverably. Take your time and use common sense while setting up the plugin.

## Setting up a WebDAV server

If you don't have access to one already, you'll need a WebDAV server before doing this. Some setup examples are shown in `webdav-servers/`.

Due to how obsidian works, CORS is in play. CORS is just as much of a pain in the ass here as anywhere else. For the plugin to work if your WebDAV server has CORS, you need to do one of two things:

1. Disable CORS; this is, by far, the easiest option, but obviously has security tradeoffs.
2. Set up CORS to allow `app://obsidian.md` and [a whole bunch of other stuff](https://github.com/remotely-save/remotely-save/blob/34db181af002f8d71ea0a87e7965abc57b294914/docs/remote_services/webdav_general/webav_cors.md?plain=1#L5) that I cannot easily summarise. Even that documentation does not include an exhaustive list.

Other requirements:

* It must be possible to fully and recursively index the DAV folder, as no manual recursion logic is implemented on the client side.
* No inline  backups can be made, unless the calls to read the entire folder omits these as if they didn't exist, and only the latest version is exposed. For example, copyparty's default behaviour on push (without `daw`) is to create copies (such as `README.md-bunch of garbage here`), which then is exposed when accessing the directory. This means the vault is always out of sync, and treats the added history files as bad.
* `X-OC-MTime` should be supported. It's supported in copyparty out of the box. Without this, the last modified time cannot be synced in the remote, so a pull is required after the push to sync mtimes to the client. This is obviously a waste of download and resources.
* Dotfile reading; if folders and files starting with `.` are omitted, the obsidian folder cannot be synced across devices. This is described later
* **Not sure how to toggle these?** Some known DAV servers are described later in this documentation.

### Setup of known WebDAV servers

* [Copyparty](docs/webdav-servers/Copyparty.md)

Other WebDAV servers are likely supported with minimal or no special setup, but I do not attempt to verify these. If you manage to verify another server, please consider opening a PR with setup instructions (if applicable; just adding a server to the list as working out of the box is also fine).

## Setting up the plugin

Before you can do any syncing, go to the WebDAV sync settings. Here, you'll need to add the following settings:

* WebDAV URL
* WebDAV username
* WebDAV password
  * **Note:** as of v0.2.0, the password uses Obsidian's SecretStorage. Prior to this, the password is kept directly in the config file. If you're using 0.1.1 or older, you must trust your webdav provider, as the password is stored and therefore synced in plain text in older versions.
* One of:
  * A share for full vault sync
  * A set of folder mappings for partial sync. See [Partial sync](docs/Partial sync.md). This is best matched with full vault sync, but should work standalone as well. This is untested though.

## Your first sync

The first push is relatively straight-forward. In the ribbon, a sync button is added by default. The ribbon is the sidebar on the left on desktop, or in the hamburger menu (three vertical lines) on mobile. An action is also available that can be run from the command palette, or bound to a key ("WebDAV sync: Open sync menu")

When clicked, you'll get a modal asking whether you want to push or pull. **You should use this for your first sync**, even if you don't want to keep the button around. It gives you access to more options than the commands do, so you can see more clearly what's going to happen before you do it.

> [!caution]
>
> It's **vitally important** that you ***do not*** press "Download" at this point. If you do not have a backup, and you did not initialise your vault in the cloud manually, your vault is gone. No security measures have been implemented yet to prevent this, so common sense is required. User error can and will fuck you up at this point.

In this menu, you'll also find a "dry run" toggle. As the toggle explains, it results in the plugin telling you what changes it would've made, but without actually performing them. This is also useful if you're pulling, but not sure what changes would've been made.

Once you click "upload", your entire vault will be synced to the remote WebDAV share. Once completed, you can verify that it's completed by trying a second upload. If it's complete, you'll get a message saying no changes were made.

> [!note]
>
> This only works reliably if your WebDAV server supports the `X-OC-MTime` header. Without it, if you use dry run, you'll see that all the files you just uploaded count as modified in the remote.

## Adding devices

One major downside with this plugin is that adding extra devices requires having at least partial vault access. Though it's possible to create a new vault, I strongly suggest you copy over your entire vault as a first sync. Once the plugin is set up, this includes everything you need to sync.

> [!note]
>
> As of 0.2.0, SecretStorage is used, which means you'll need to relink the password after copying. Make sure you use the same key name on both devices. The key name is synced between devices via the settings file, so a conflict between devices on the key name will cause the password to keep delinking on sync. This is a weakness in how obsidian set up secret linkage.

## Day-to-day syncing

There's both a ribbon entry and currently two actions that can be used to actually do the syncing. There will be more actions in the future that cover everything you'd do with the ribbon entry, but this plugin is still in an early development phase.

The sync modal (opened through the ribbon) offers all the available per-sync options. At the time of writing, these include:

* **Dry run**: does everything a normal sync would do, but disables the actual push or pull step, and shows all the actions that would've been taken. Useful for debugging, or checking if you forgot to sync :) Also logs both the remote and local files to the console if you want to see even more data. **Note that you need to update the log level in your console to see these logs**. Obsidian forbids `.log` calls in the submission process for whatever reason, even when it's explicitly requested.
* **Don't delete anything**: disables deletion. Mainly useful if you forget to push, and made changes that you need to pull. Setting this preserves those files so you can push, but can also result in files you intentionally deleted being restored on a push. Like I said, deletion-aware sync is hard, and this plugin does not bother with it.

Aside the modal, raw upload and download actions exist, accessible via Ctrl-P (search "WebDAV:" to see all the available actions). Unless otherwise specified, the actions use all default settings, which amy be undesirable. If you need more control, use the modal.
