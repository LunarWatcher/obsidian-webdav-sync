# WebDAV sync

[![Test and build nightly artefacts](https://github.com/LunarWatcher/obsidian-webdav-sync/actions/workflows/build.yml/badge.svg)](https://github.com/LunarWatcher/obsidian-webdav-sync/actions/workflows/build.yml)

This is a very simple sync plugin for Obsidian based on WebDAV. You need to bring your own WebDAV server to use this plugin. Theoretically, all WebDAV-compatible servers are supported, though there are some requirements for the general behaviour of the server. This is described in a later section. No special, non-standard features are used, so this plugin (unlike far too many WebDAV implementations in general) is not vendorlocked to NextCloud.

[Documentation](https://lunarwatcher.github.io/obsidian-webdav-sync/) · [Source code (Codeberg)](https://codeberg.org/LunarWatcher/obsidian-webdav-sync) · [Source code (GitHub)](https://github.com/LunarWatcher/obsidian-webdav-sync) · [Plugin registry entry](https://community.obsidian.md/plugins/livi-webdav-sync)

## Features

* Sync is not automatic, so there's no need for a proper deletion-aware merge algorithm. Merging is relatively easy, but _deletion_ merge is not if you need to do a two-way merge with arbitrary sync times. That said, there is no content-level merge algorithm; there's handling of file-level conflicts, but it's assumed you're able to track those yourself and know what you changed. If you regularly make changes to the same files and forget pulling, this plugin is probably not right for you.
* Support for partial vault sync, where specific folders can be imported. This primarily exists because I want to sync some folders between my private and work vaults, but without syncing everything (work notes stay at work, private notes stay at home). **This is currently mutually exclusive with full vault sync**, but this will change in the future.
* `.obsidian` is synced by default - but it can be excluded if desired.
* [TODO] An optional webhook can be run on push. The intent here is to allow for push-aware backup systems to do their thing only when it's needed. Versioning shouldn't need be a feature of the sync plugin itself when the specific needs for sync are diverse.

### Non-goals

This plugin is intentionally simplistic merge-wise. As a result, content-level merging will never be a feature. If this is something you need, I suggest finding another plugin. The merge algorithms explode in complexity when file content is involved, and especially if automatic sync ever becomes a potential option.

## Requirements

* Android or desktop (Windows or Linux)
    * macOS and iOS will not receive support from me, as I refuse to spend thousands of euros for inferior hardware and an inferior platform. If you need iOS or macOS support and it doesn't work due to Apple-specific problems, you're welcome to add it in a PR, but it will not be created, maintained, or tested any other way. It may work, but it probably won't.
* A WebDAV server. In theory, it should work with any WebDAV-compatible server, though I only test against [copyparty](https://github.com/9001/copyparty). Additional requirements are described in [the documentation](https://lunarwatcher.github.io/obsidian-webdav-sync/getting-started.html#setting-up-a-webdav-server)

### Android notes

Due to a [16 year old bug](https://issuetracker.google.com/issues/36906982), the vault shouldn't be on an SD card. If you put it on an SD card, when pulling the vault, the last modified time of the file won't be correctly set. This results in a situation where the android copy of the vault is always considered fully out of sync with the WebDAV server.

Sync will still work if you put the vault on an SD card, but if you have a large vault, you'll need to download and upload the entire thing every time you sync.

The [underlying bug](https://github.com/LunarWatcher/obsidian-webdav-sync/issues/1) could be resolved by relying on hashes rather than `mtime`, but these are difficult to generate on the fly. Since it requires reading the full contents of the files, it'll still tank performance in large vaults, so it's not particularly helpful. Alternate solutions are welcome.

### Stability notes

Although the plugin shouldn't cause any problems, I strongly suggest taking backups of your vault, **especially** before the first sync. After the first sync, your devices act as a form of backup that can push a clean state back to the WebDAV server, provided it's correctly configured. However, the process of verifying that everything has been set up correctly and works correctly together is somewhat risky. You should back your vault up before using the plugin for the first time. You should also keep regular backups even if the risk is low - this is just good practice in general.

## Installation

See [the docs](https://lunarwatcher.github.io/obsidian-webdav-sync/#installing-the-plugin)

## Setup

### Adding additional devices

The major disadvantage with this plugin is that some setup is required to get the vault over to other devices. The suggested strategy is to manually copy your vault from your computer (or whereever you installed the plugin) over to your other devices. After that, usage should just be as usual. In theory, you can get away with just copying the `.obsidian` folder and just pull that.

### First use and WebDAV server requirements

See [Getting started.md](https://github.com/LunarWatcher/obsidian-webdav-sync/blob/master/docs/Getting%20started.md). It can also be read on a [violet-generated website](https://lunarwatcher.github.io/obsidian-webdav-sync/getting-started.html) if you prefer.

## Things to note

### Race conditions

WebDAV sync is not thread-safe. If you run two pushes at once, you will end up with an inconsistent state. It's therefore not recommended to use this plugin for collaborative note repositories, unless you have another way to avoid race conditions.

Due to the lack of content-level merge, ending up in a situation like this requires manual recovery.

## Plugin rationale

WebDAV, although being an open standard, has been heavily undermined by cloud services using proprietary protocols to vendor lock people into their specific ecosystem - a strategy that, unfortunately, has been wildly successful. I'm also counting Nextcloud as a cloud service in this context, as many webdav implementations end up prioritizing Nextcloud to the point where it's really a Nextcloud integration rather than a WebDAV integration.

The options available for syncing either to my self-hosted NAS or to Proton Drive are limited thanks to one important detail; the problem child called mobile operating systems. [DAVx5](https://www.davx5.com/)[^3] doesn't support syncing files locally. Instead, they provide an Android Storage Framework adapter thing that apps can use, but that [Obsidian does not support](https://forum.obsidian.md/t/android-support-the-storage-access-framework/23234). On Linux, a mounted filesystem makes no distinction on whether it's local or remote, and desktop Obsidian can happily work straight off a WebDAV folder. The only disadvantage with this strategy is that no data is stored locally, which isn't great if I'm sitting remotely (or worse, somewhere without internet access). Therefore, a plugin is still needed to support local states.

As far as I know, Proton Drive can't be easily supported, and the options for webdav are limited to a few obscure and abandoned plugins[^2], and the fairly well-established [remotely-save plugin](https://github.com/remotely-save/remotely-save), which does quite a few supported target locations. Unfortunately, its development capacity is limited, and at the time of writing, the last commit was in 2024.

Sync algorithms are hard enough of a problem that my solution is to not bother. With manual sync and overriding, many entire categories of bugs and edge-cases that can wipe vaults are avoided. There are almost certainly still some such bugs, but it's much easier to safeguard against them, especially because faults don't automatically propagate to all available devices - if you have two devices, you already have a backup.

---

I do need to mention [Vinzent03/obsidian-git](https://github.com/Vinzent03/obsidian-git), which is the closest you get in spirit to the idea behind this plugin. This is the plugin I would use if it was viable, as I already have an SSH port exposed, and a self-hosted instance of Forgejo available. In terms of setup, it would be the easiest alternative. Unfortunately, [it lacks Android support for SSH keys](https://github.com/Vinzent03/obsidian-git?tab=readme-ov-file#-mobile-support-%EF%B8%8F--experimental), as Git isn't Android-native, and reimplementing all of Git is bound to cause issues. On top of that, it appears that isomorphic-git (the underlying git-reimplementing library) [doesn't support SSH keys](https://github.com/isomorphic-git/isomorphic-git/issues/231#issuecomment-2699927384), which makes it incompatible with my security model, and unusable for my use-case. The trouble child called mobile operating systems strikes again.

WebDAV, on the other hand, is both simple enough and well-established enough that it has decent clients in every programming language worth caring about. It does require some more work for a sync algorithm that would otherwise be bundled in Git, but it's portable.

## License

The plugin itself is licensed under the [MIT license](LICENSE). The documentation is licensed under [CC-By-SA 4.0](docs/LICENSE)

[^2]: Another plugin was made ~6 months after this one, and consequently after this sentence was initially written. However, it's built on an AI slop foundation, so I do not trust it.
[^3]: DAVx5 is a fantastic app. The only reason it doesn't cut it here is that Obsidian limits itself from being able to use the DAVx5 shares.
