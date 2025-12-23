# WebDAV sync

This is a very simple sync plugin for Obsidian based on WebDAV. You need to bring your own WebDAV server to use this plugin. Theoretically, all WebDAV-compatible servers are supported, though there are some requirements for the general behaviour of the server. This is described in a later section. No special, non-standard features are used, so this plugin (unlike far too many WebDAV implementations in general) is not vendorlocked to NextCloud.

## Features

* Sync is not automatic, so there's no need for a proper deletion-aware merge algorithm. Merging is relatively easy, but _deletion_ merge is not if you need to do a two-way merge with arbitrary sync times. That said, there is no content-level merge algorithm; there's handling of file-level conflicts, but it's assumed you're able to track those yourself and know what you changed. If you regularly make changes to the same files and forget pulling, this plugin is probably not right for you.
* Support for partial vault sync, where specific folders can be imported. This primarily exists because I want to sync some folders between my private and work vaults, but without syncing everything (work notes stay at work, private notes stay at home). **This is currently mutually exclusive with full vault sync**, but this will change in the future.
* [TODO] An optional webhook can be run on push. The intent here is to allow for push-aware backup systems to do their thing only when it's needed. Versioning shouldn't need be a feature of the sync plugin itself when the specific needs for sync are diverse.

### Non-goals

This plugin is intentionally simplistic merge-wise. As a result, content-level merging will never be a feature. If this is something you need, I suggest finding another plugin. The merge algorithms explode in complexity when file content is involved, and especially if automatic sync ever becomes a potential option.

## Rationale

I have 18TB of self-hosted NAS storage, and 500GB of Proton Drive storage (part of what my 120 EUR/year gets me when I wanted protonmail, Proton VPN, and Proton Pass); I do not want to pay another 96 USD/year + bank currency conversion costs, so my data can sync to a different cloud than either of the two options I already have available. Until August 2025, I used syncthing, but the official Android app was discontinued months prior without me noticing. Although the client was forked, jumping from an official app developed by one person to an unofficial app developed by one person does not sound particularly tempting.

WebDAV, although being an open standard, has been heavily undermined by cloud services using proprietary protocols to vendor lock people into their specific ecosystem - a strategy that has been wildly successful. The additional consequence of this is that no free options exist for syncing WebDAV in a similar way to Obsidian. The hardest part here is file deletion, and this is a hard problem the sync plugins are struggling with as well. The solutions that claim to solve this are proprietary or otherwise expensive.

Unfortunately, the options available for syncing either to my self-hosted NAS or to Proton Drive are limited thanks to one important detail; the problem child called mobile operating systems. [DAVx5](https://www.davx5.com/), a fantastic app may I add, doesn't support syncing files locally. They provide an Android Storage Framework adapter thing that apps can use, but that [Obsidian does not support](https://forum.obsidian.md/t/android-support-the-storage-access-framework/23234). On Linux, a mounted filesystem makes no distinction on whether it's local or remote, and desktop Obsidian can happily work straight off a WebDAV folder. The only disadvantage with this strategy is that no data is stored locally, which isn't great if I'm sitting remotely (or worse, on a)

As far as I know, Proton Drive can't be easily supported, and the options for webdav are limited to a few obscure and abandoned plugins, and the fairly well-established [remotely-save plugin](https://github.com/remotely-save/remotely-save), which does quite a few supported target locations. Unfortunately, its development capacity is limited, and at the time of writing, the last commit was 9 months ago, and there are nearly 150 issues and 13 open PRs, all 13 of which have been opened in the last year. Several of the bugs describe problems with the sync algorithm, which is a huge problem. A plugin that has to state "ALWAYS, ALWAYS, back up your vault before using this plugin" for something that's supposed to be used continuously does not inspire confidence.[^1]

Sync algorithms are hard enough of a problem that my solution is to not bother. With manual sync and overriding, many entire categories of bugs and edge-cases that can wipe vaults are avoided. There are almost certainly still some such bugs, but it's much easier to safeguard against them, especially because faults don't automatically propagate to all available devices - if you have two devices, you already have a backup.

---

I do need to mention [Vinzent03/obsidian-git](https://github.com/Vinzent03/obsidian-git), which is the closest you get in spirit to the idea behind this plugin. This is the plugin I would use if it was viable, as I already have an SSH port exposed, and a self-hosted instance of Forgejo available. In terms of setup, it would be the easiest alternative. Unfortunately, [it lacks Android support for SSH keys](https://github.com/Vinzent03/obsidian-git?tab=readme-ov-file#-mobile-support-%EF%B8%8F--experimental), as Git isn't Android-native, and reimplementing all of Git is bound to cause issues. On top of that, it appears that isomorphic-git (the underlying git-reimplementing library) [doesn't support SSH keys](https://github.com/isomorphic-git/isomorphic-git/issues/231#issuecomment-2699927384), which makes it incompatible with my security model, and unusable for my use-case. The trouble child called mobile operating systems strikes again.

WebDAV, on the other hand, is both simple enough and well-established enough that it has decent clients in every programming language worth caring about. It does require some more work for a sync algorithm that would otherwise be bundled in Git, 

## Requirements

* Android or desktop (Windows or Linux)
    * macOS and iOS will not receive support from me, as I refuse to spend thousands of euros for inferior hardware and an inferior platform. If you need iOS or macOS support and it doesn't work due to Apple-specific problems, you're welcome to add it in a PR, but it will not be created, maintained, or tested any other way. It may work, but it probably won't.
* A WebDAV server. In theory, it should work with any WebDAV-compatible server, though I only test against [copyparty](https://github.com/9001/copyparty). More specific requirements:
    * No inline  backups can be made, unless the calls to read the entire folder omits these as if they didn't exist, and only the latest version is exposed. For example, copyparty's default behaviour on push (without `daw`) is to create copies (such as `README.md-bunch of garbage here`), which then is exposed when accessing the directory. This means the vault is always out of sync, and treats the added history files as bad.
    * `X-OC-MTime` should be supported. It's supported in copyparty out of the box. Without this, the last modified time cannot be synced in the remote, so a pull is required after the push to sync mtimes to the client. This is obviously a waste of download and resources.
    * Dotfile reading; if folders and files starting with `.` are omitted, the obsidian folder cannot be synced across devices. This is described later
    * **Not sure how to toggle these?** Some known DAV servers are described later in this documentation.

### Android notes

Due to a [16 year old bug](https://issuetracker.google.com/issues/36906982), the vault shouldn't be on an SD card. If you put it on an SD card, when pulling the vault, the last modified time of the file won't be correctly set. This results in a situation where the android copy of the vault is always considered fully out of sync with the WebDAV server.

Sync will still work if you put the vault on an SD card, but if you have a large vault, you'll need to download and upload the entire thing every time you sync. 

The [underlying bug](https://github.com/LunarWatcher/obsidian-webdav-sync/issues/1) could be resolved by relying on hashes rather than `mtime`, but these are difficult to generate on the fly. Since it requires reading the full contents of the files, it'll still tank performance in large vaults, so it's not particularly helpful. Alternate solutions are welcome.

### Stability notes

Although the plugin shouldn't cause any problems, I strongly suggest taking backups of your vault, **especially** before the first sync. After the first sync, your devices act as a form of backup that can push a clean state back to the WebDAV server, provided it's correctly configured. However, the process of verifying that everything has been set up correctly and works correctly together is somewhat risky. You should back your vault up before using the plugin for the first time. You should also keep regular backups even if the risk is low - this is just good practice in general.

## Installation

### Via GitHub
Once this plugin is release-ready, you can grab the latest release from [GitHub](https://github.com/LunarWatcher/obsidian-webdav-sync/releases). Download it, and add the `webdav-sync` folder to your vault's `.obsidian/plugins/` folder. The plugin is not yet available through the plugin store thing, so it'll need to be updated manually as well; this is done the same way.

### Via Obsidian's plugin registry [pending]

An [upload to Obsidian's plugin registry is pending](https://github.com/obsidianmd/obsidian-releases/pull/7716), but will likely take weeks to months to actually merge because they're slow. The release and nightly artefacts are still usable in the meanwhile. 

### Via BRAT

There isn't a separate release cycle for preview versions, but until Obsidian reviews the plugin, you can install the plugin via [BRAT](https://github.com/TfTHacker/obsidian42-brat) to get automatic updates.


## Setup

### Adding additional devices

The major disadvantage with this plugin is that some setup is required to get the vault over to other devices. The suggested strategy is to manually copy your vault from your computer (or whereever you installed the plugin) over to your other devices. After that, usage should just be as usual. In theory, you can get away with just copying the `.obsidian` folder and just pull that.

### DAV server setup

#### General requirements (all servers)

Due to how obsidian works, CORS is in play. CORS is just as much of a pain in the ass here as anywhere else. For obsidian to work, if your WebDAV server has CORS, you need to do one of two things:

1. Disable CORS; this is, by far, the easiest option, but obviously has security tradeoffs.
2. Set up CORS to allow `app://obsidian.md` and [a whole bunch of other stuff](https://github.com/remotely-save/remotely-save/blob/34db181af002f8d71ea0a87e7965abc57b294914/docs/remote_services/webdav_general/webav_cors.md?plain=1#L5) that I cannot easily summarise. Even that documentation does not include an exhaustive list.

Other requirements:

* It must be possible to fully and recursively index the DAV folder, as no manual recursion logic is implemented on the client side.

#### Setup of known WebDAV servers

* [Copyparty](docs/webdav-servers/Copyparty.md)

Other WebDAV servers are likely supported with minimal or no special setup, but I do not attempt to verify these. If you manage to verify another issue, please consider opening a PR with setup instructions.

### First use

See [Getting started.md](https://github.com/LunarWatcher/obsidian-webdav-sync/blob/master/docs/Getting%20started.md). It can also be read on an [mkdocs-generated website](https://lunarwatcher.github.io/obsidian-webdav-sync/Getting%20started/) if you prefer.

## Things to note

### Race conditions

WebDAV sync is not thread-safe. If you run two pushes at once, you will end up with an inconsistent state. It's therefore not recommended to use this plugin for collaborative note repositories, unless you have another way to avoid race conditions.

Due to the lack of content-level merge, ending up in a situation like this requires manual recovery. 

[^1]: This is not to say that vault backups are a bad idea, but the way it's phrased makes it sound like breaking errors happen on a regular basis. Especially considering the number of issues, it looks like this is the case.
