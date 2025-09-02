# Copyparty setup

If you're using copyparty, note that your user needs access to dotfiles (the `.` permission) if you're doing full vault sync. Without it, the `.obsidian` folder is omitted. It's also strongly suggested that you don't keep the `hist` cache inside the folder, as it can and almost certainly will cause issues with copyparty.
```conf
[global]
    hist: ~/.cache/copyparty
    # For reasons described at the top of the DAV server section
    # This may or may not be the only way to achieve the goal, but it's easy and I don't care
    # If you do, you're welcome to change this to whatever allows app://obsidian.md and apparently
    # many other things instead.
    allow-csrf
    dav-inf

    # Enables full webdav writes - for copyparty, this means redundant files aren't 
    # made on PUT that require deleting. 
    # Omitting this means the actual files will always be out of sync.
    daw
```

## Example: Full vault sync
The setup for a vault is mostly completely standard. The minimum identified set of permissions for a user is `rwmd.`. The `.` is required for `.obsidian` to be synced as well.

```conf
[/livi/obsidian]
    /media/NAS/Documents/mdwiki
    accs:
      # the a is optional, but I use it here because this is my 
      # superuser account, and it should get access to everything
      rwmda.: olivia
```

## Example: Partial vault sync

```conf
# The root vault folder is just a normal share
[/livi/obsidian]
    /media/NAS/Documents/mdwiki
    accs:
      rwmda.: olivia

# Subfolders are stored relative to the regular share
# There's technically nothing preventing fully separate shares
# with partial vault sync, but the general assumption is that 
# the partial sync is from a vault, not an arbitrary markdown
# directory.
[/livi/obsidian/Tech]
    /media/NAS/Documents/mdwiki/Tech
    accs:
      rwmda.: olivia
      rwmd.: potentially-unsafe-access
```
