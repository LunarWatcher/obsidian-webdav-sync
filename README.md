# Obsidian WebDAV sync

This is a very simple sync plugin based on WebDAV. You need to bring your own server to use this plugin.

This sync plugins differs substantially from many of the other sync plugins, due to:

* Sync is not automatic, so there's no need for a deletion-aware merge algorithm. Merging is relatively easy, but _deletion_ merge is not. In fact, there's no proper merge algorithm at all. The highest resolution you get is per-file selection in the evnet of conflict, as the assumption is a workflow that never ends up out of sync. This is also spoken like a developer, because I stay on top of my Git states the majority of the time.
* [TODO] Support for partial vault sync, where specific folders can be imported. This primarily exists because I want to sync some folders between my private and work vaults, but without syncing everything (work notes stay at work, private notes stay at home).
* [TODO] An optional webhook can be run on push. The intent here is to allow for push-aware backup systems to do their thing only when it's needed. Versioning shouldn't need be a feature of the sync plugin itself when the specific needs for sync are diverse.

## Rationale

I have 20TB of self-hosted NAS storage, and 500GB of Proton Drive storage (part of what my 135 EUR/year gets me when I wanted protonmail, Proton VPN, and Proton Pass); I do not want to pay another 96 USD/year + bank currency conversion costs, so my data can sync to a different cloud than either of the two options I already have available. Until August 2025, I used syncthing, but the official Android app was discontinued. Although the client was forked, jumping from an official app developed by one person to an unofficial app developed by one person does not sound particularly tempting.

WebDAV, although being an open standard, has been heavily undermined by cloud services using proprietary protocols to vendor lock people into their specific ecosystem - a strategy that has been wildly successful. The additional consequence of this is that no free options exist for syncing WebDAV in a similar way to Obsidian. The hardest part here is file deletion, and this is a hard problem the sync plugins are struggling with as well. The solutions that claim to solve this are proprietary or otherwise expensive.

Unfortunately, the options available for syncing either to my self-hosted NAS or to Proton Drive are limited thanks to one important detail; the problem child called mobile operating systems. [DAVx5](https://www.davx5.com/), a fantastic app may I add, doesn't support syncing files locally. They provide an Android Storage Framework adapter thing that apps can use, but that [Obsidian does not support](https://forum.obsidian.md/t/android-support-the-storage-access-framework/23234). On Linux, a mounted filesystem makes no distinction on whether it's local or remote, and desktop Obsidian can happily work straight off a WebDAV folder. The only disadvantage with this strategy is that no data is stored locally, which isn't great if I'm sitting remotely (or worse, on a)

As far as I know, Proton Drive can't be easily supported, and the options for webdav are limited to a few obscure and abandoned plugins, and the fairly well-established [remotely-save plugin](https://github.com/remotely-save/remotely-save), which does quite a few supported target locations. Unfortunately, its development capacity is limited, and at the time of writing, the last commit was 9 months ago, and there are nearly 150 issues and 13 open PRs, all 13 of which have been opened in the last year. Several of the bugs describe problems with the sync algorithm, which is a huge problem. A plugin that has to state "ALWAYS, ALWAYS, back up your vault before using this plugin" for something that's supposed to be used continuously does not inspire confidence. 

Sync algorithms are hard enough of a problem that my solution is to not bother. With manual sync and overriding, many entire categories of bugs and edge-cases that can wipe vaults are avoided. There are almost certainly still some such bugs, but it's much easier to safeguard against them, especially because faults don't automatically propagate to all available devices - if you have two devices, you already have a backup.

---

I do need to mention [Vinzent03/obsidian-git](https://github.com/Vinzent03/obsidian-git), which is the closest you get in spirit to the idea behind this plugin. This is the plugin I would use if it was viable, as I already have an SSH port exposed, and a self-hosted instance of Forgejo available. In terms of setup, it would be the easiest alternative. Unfortunately, [it lacks Android support](https://github.com/Vinzent03/obsidian-git?tab=readme-ov-file#-mobile-support-%EF%B8%8F--experimental), as Git isn't Android-native, and reimplementing all of Git is bound to cause issues. On top of that, it appears that isomorphic-git (the underlying git-reimplementing library) [doesn't support SSH keys](https://github.com/isomorphic-git/isomorphic-git/issues/231#issuecomment-2699927384), which makes it incompatible with my security model, and unusable for my use-case. The trouble child called mobile operating systems strikes again.

WebDAV, on the other hand, is both simple enough and well-established enough that it has decent clients in every programming language worth caring about. It does require some more work for a sync algorithm that would otherwise be bundled in Git, 

## Requirements

* Android or desktop (Windows or Linux)
    * macOS and iOS will not receive support from me, as I refuse to spend thousands of euros for inferior hardware and an inferior platform. If you need iOS or macOS support and it doesn't work due to Apple-specific problems, you're welcome to add it in a PR, but it will not be created, maintained, or tested any other way.
* A WebDAV server. In theory, it should work with any WebDAV-compatible server, though I only test against [copyparty](https://github.com/9001/copyparty).

## Installation and setup

Once this plugin is release-ready, you can grab the latest release from [GitHub](https://github.com/LunarWatcher/obsidian-webdav-sync/releases). Download it, and add the `obsidian-webdav-sync` folder to your vault's `.obsidian/plugins/` folder. The plugin is not yet available through the plugin store thing, so it'll need to be updated manually as well; this is done the same way.

### Additional devices

The major disadvantage with this plugin is that some setup is required to get the vault over to other devices. The suggested strategy is to manually copy your vault from your computer (or whereever you installed the plugin) over to your other devices. After that, usage should just be as usual.

### DAV server setup

#### General requirements (all servers)

Due to how obsidian works, CORS is in play. CORS is just as much of a pain in the ass here as anywhere else. For obsidian to work, if your WebDAV server has CORS, you need to do one of two things:

1. Disable CORS; this is, by far, the easiest option, but obviously has security tradeoffs.
2. Set up CORS to allow `app://obsidian.md` and [a whole bunch of other stuff](https://github.com/remotely-save/remotely-save/blob/34db181af002f8d71ea0a87e7965abc57b294914/docs/remote_services/webdav_general/webav_cors.md?plain=1#L5) that I cannot easily summarise. Even that documentation does not include an exhaustive list.

#### Copyparty setup

If you're using copyparty, note that your user needs access to dotfiles (the `.` permission) if you're doing full vault sync. Without it, the `.obsidian` folder is omitted. It's also strongly suggested that you don't keep the `hist` cache inside the folder, as it can and almost certainly will cause issues with copyparty.
```conf
[global]
    hist: ~/.cache/copyparty
    # For reasons described at the top of the DAV server section
    # This may or may not be the only way to achieve the goal, but it's easy and I don't care
    # If you do, you're welcome to change this to whatever allows app://obsidian.md and apparently
    # many other things instead.
    allow-csrf
```
