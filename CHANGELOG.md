# Changelog

## 0.3.0

### Added

* Added option to not sync the config folder (`.obsidian`). Defaults to being disabled for compatibility and intended behaviour. 

### Internals

* Disabled Obsidian's eslint plugin, as the false positives are too annoying to deal with when the plugin is stuck in review purgatory for half a year regardless of whether it's enabled or not. I'm done playing along with that shit when all it does is make the dev experience orders of magnitude worse

## 0.2.1

Security and dep updates

## 0.2.0

### Added

* SecretStorage for the webdav password

## 0.1.1

### Changed

* Clarified the wording near the WebDAV settings for the password so it's more obvious that it's pushed alongside the vault. This was already mentioned in the documentation, but this is much harder to miss.

## 0.1.0

### Fixed

* The modal buttons are now disabled during an upload. There should ideally be a progress bar as well, but the previous system provided no feedback at all, and this is required anyway.

## 0.0.4

### Added
* Safeguards for deleting everything, or nearly everything. Pushes deleting either everything, or everything outside the .obsidian folder is now hard blocked. It is left open as an option in the sync dialog, but it's default-enabled.


## 0.0.1 through 0.0.3

Initial version plus tweaks for the upload to the obsidian registry.
