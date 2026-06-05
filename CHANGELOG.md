# Changelog

## 0.5.2

### Added

* An action with the same functionality as the ribbon button
* Docs for where the actions are located

## 0.5.1

### Fixed

* Silenced a few new warnings from obsidian's new scan
* `document` -> `activeDocument` (though I doubt it matters for this plugin)

### Chores

* Bump deps

## 0.5.0

> [!caution]
> This plugin has a new ID and therefore a new folder. The existing copy of the plugin must be removed before updating

Re-release of 0.4.0 with a new plugin id (`livi-webdav-sync`). Because Obsidian [redid their entire plugin submission system](https://obsidian.md/blog/future-of-plugins/), and due to [another plugin having the same id (`webdav-sync`)](https://github.com/hesprs/obsidian-webdav-sync) also being pending at the time of the migration of existing submissions, this plugin lost its ID in spite of being submitted ~6 months prior to hesprs' plugin.

### Migrating

#### Preserving config

1. Rename `webdav-sync` to `livi-webdav-sync`
2. Use standard methods for updating via github
3. You can now (maybe) update like normal via the plugin registry rather than manually via GitHub. The first update likely has to be manual due to the changed plugin ID.

#### Discarding config 

1. Delete `webdav-sync` and download from GitHub or the obsidian plugin registry: https://community.obsidian.md/plugins/livi-webdav-sync

## 0.4.0

> [!caution]
> 0.5.0 was forced to changed the plugin ID due to changes to obsidian's publication process resulting in the plugin's ID (still in use in this version) being lost. Installs of this version are wholly unsupported and discouraged. See the changelog for 0.5.0 for upgrade instructions. 0.5.0 is otherwise indentical to 0.4.0, but requires manual intervention to update.

### Added

* Deleted files now respect the default setting in obsidian for how files should be trashed, provided obsidian can report the file as existing. If obsidian can't, it's hard-deleted instead, as it would've been prior to this change.
* Heavy input validation in the settings menu
* Links to the docs straight from the settings menu as a failsafe for unclear settings options. Would be beneficial to get more input to make them better, but this will have to do for now.
* Links to the Codeberg mirror repo

### Fixed

* The button for adding a sub-folder split is now disabled if full vault sync is enabled.

## 0.3.0

> [!caution]
> 0.5.0 was forced to changed the plugin ID due to changes to obsidian's publication process resulting in the plugin's ID (still in use in this version) being lost. Installs of this version are wholly unsupported and discouraged. See the changelog for 0.5.0 for upgrade instructions.

### Added

* Added option to not sync the config folder (`.obsidian`). Defaults to being disabled for compatibility and intended behaviour.

### Internals

* Disabled Obsidian's eslint plugin, as the false positives are too annoying to deal with when the plugin is stuck in review purgatory for half a year regardless of whether it's enabled or not. I'm done playing along with that shit when all it does is make the dev experience orders of magnitude worse
* ... and outright disabled eslint since it's a pile of shit that adds negative value to the code quality (and nothing of value was lost by doing so, aside my time for not having done it sooner)

## 0.2.1

> [!caution]
> 0.5.0 was forced to changed the plugin ID due to changes to obsidian's publication process resulting in the plugin's ID (still in use in this version) being lost. Installs of this version are wholly unsupported and discouraged. See the changelog for 0.5.0 for upgrade instructions.

Security and dep updates

## 0.2.0

> [!caution]
> 0.5.0 was forced to changed the plugin ID due to changes to obsidian's publication process resulting in the plugin's ID (still in use in this version) being lost. Installs of this version are wholly unsupported and discouraged. See the changelog for 0.5.0 for upgrade instructions.

### Added

* SecretStorage for the webdav password

## 0.1.1

> [!caution]
> 0.5.0 was forced to changed the plugin ID due to changes to obsidian's publication process resulting in the plugin's ID (still in use in this version) being lost. Installs of this version are wholly unsupported and discouraged. See the changelog for 0.5.0 for upgrade instructions.

### Changed

* Clarified the wording near the WebDAV settings for the password so it's more obvious that it's pushed alongside the vault. This was already mentioned in the documentation, but this is much harder to miss.

## 0.1.0

> [!caution]
> 0.5.0 was forced to changed the plugin ID due to changes to obsidian's publication process resulting in the plugin's ID (still in use in this version) being lost. Installs of this version are wholly unsupported and discouraged. See the changelog for 0.5.0 for upgrade instructions.

### Fixed

* The modal buttons are now disabled during an upload. There should ideally be a progress bar as well, but the previous system provided no feedback at all, and this is required anyway.

## 0.0.4

> [!caution]
> 0.5.0 was forced to changed the plugin ID due to changes to obsidian's publication process resulting in the plugin's ID (still in use in this version) being lost. Installs of this version are wholly unsupported and discouraged. See the changelog for 0.5.0 for upgrade instructions.

### Added
* Safeguards for deleting everything, or nearly everything. Pushes deleting either everything, or everything outside the .obsidian folder is now hard blocked. It is left open as an option in the sync dialog, but it's default-enabled.


## 0.0.1 through 0.0.3

> [!caution]
> 0.5.0 was forced to changed the plugin ID due to changes to obsidian's publication process resulting in the plugin's ID (still in use in this version) being lost. Installs of this version are wholly unsupported and discouraged. See the changelog for 0.5.0 for upgrade instructions.

Initial version plus tweaks for the upload to the obsidian registry.
