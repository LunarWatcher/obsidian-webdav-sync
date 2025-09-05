# Getting started

## Words of warning

The plugin is designed to minimise risk during normal operation. No automatic sync means that every device you have acts as a separate backup of the vault, so even if something goes wrong, you have a path to recovery. 

However, during setup, there are a few failure points that the plugin hasn't been configured to protect you from. Worst-case, you wipe your vault.

The plan eventually is to outright (and without the ability to bypass) block the ability to do a full wipe on pull, but  this is not yet implemented. During plugin setup, you _need_ to read the docs before you do anything, as going for "download" without first pushing your vault will wipe your vault locally.

For good measure, I suggest taking a backup before first-time use. If all you have is one copy of the vault, user error can and will destroy it irrecoverably. Take your time and use common sense while setting up the plugin.

## Setting up a WebDAV server

If you don't have access to one already, you'll need a WebDAV server before doing this. Some setup examples are shown in `webdav-servers/`.

TODO: requirements here? (See README for now)

## Setting up the plugin

Before you can do any syncing, go to the WebDAV sync settings. Here, you'll need to add the following settings:

* WebDAV URL
* WebDAV username
* WebDAV password
* One of:
    * A share for full vault sync
    * A set of folder mappings for partial sync. See [Partial sync](https://github.com/LunarWatcher/obsidian-webdav-sync/blob/master/docs/Partial%20sync.md). This is best matched with full vault sync, but should work standalone as well. This is untested though.


> [!warning] 
>
> **Trust your WebDAV provider.**
> 
> Due to a quirk of how sync works, your WebDAV password is also synced to the WebDAV share, as obsidian has no way to securely store credentials at the time of writing. In the future, explicit ignore rules will be added that allows this file to be ignored. 
> 
> In the meanwhile, this means that you need to trust your WebDAV provider. If you use a sketchy cloud provider where data isn't encrypted, for example, they may be able to grab your account password. Encrypted sync is not a planned feature, as the default assumption is that you own your data, and therefore don't need to encrypt it.

## Your first sync

The first push is relatively straight-forward. In the ribbon, a sync button is added by default. When clicked, you'll get a modal asking whether you want to push or pull. **You should use this for your first sync**, even if you don't want to keep the button around. It gives you access to more options than the commands do, so you can see more clearly what's going to happen before you do it.

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
> Passwords are stored in plain text in `.obsidian/plugins/webdav-sync/data.json`, as that's how Obsidian does things. Remove this file before copying if you want to set up the plugin from scratch for whatever reason.

## Day-to-day syncing

There's both a ribbon entry and currently two actions that can be used to actually do the syncing. There will be more actions in the future that cover everything you'd do with the ribbon entry, but this plugin is still in an early development phase. 

The sync modal (opened through the ribbon) offers all the available per-sync options. At the time of writing, these include:

* **Dry run**: does everything a normal sync would do, but disables the actual push or pull step, and shows all the actions that would've been taken. Useful for debugging, or checking if you forgot to sync :)
* **Don't delete anything**: disables deletion. Mainly useful if you forget to push, and made changes that you need to pull. Setting this preserves those files so you can push, but can also result in files you intentionally deleted being restored on a push. Like I said, deletion-aware sync is hard, and this plugin does not bother with it.

Aside the modal, raw upload and download actions exist, accessible via Ctrl-P (search "WebDAV:" to see all the available actions). Unless otherwise specified, the actions use all default settings, which amy be undesirable. If you need more control, use the modal.
