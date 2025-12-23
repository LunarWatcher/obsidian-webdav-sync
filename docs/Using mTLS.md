# Using mTLS

This is not plugin-specific documentation, but describes how Obsidian works with mTLS at the time of writing. The TL;DR: is poorly, but not badly enough that reinventing the wheel is worth it.

## Mobile support: None

This is due to intentional configuration by the Obsidian team. A feature request has been open since 2021: https://forum.obsidian.md/t/allow-user-supplied-root-certificates-weaken-security/26764

If you'd like to see this feature, like it I guess? I don't know how they prioritise features, nor if the feature is even still on the table.

There may also be ways around it by using non-standard `fetch` versions, though a quick search I did only found Node-based clients, which Obsidian's docs state won't work on Android.

## Desktop support: jank as fuck

The desktop app has no support for mTLS directly, but it _does_ seem to respect system stores even if the certs aren't added through obsidian. Well, specifically, it supports the Chrome system store, which I assume all electron apps are going to do by default.

### Linux
If `~/.pki/nssdb` doesn't exist, you need to create it first using:
```bash
certutil -d ~/.pki/nssdb -N --empty-password
```

If you have Chrome or Chromium installed, this folder has likely been generated for you already.

```bash
pk12util -i cert.p12 -d sql:$HOME/.pki/nssdb -W <password>
```

On Debian and derivatives, these come from `libnss3-tools`.

### Windows 

Double-click the `.p12` and follow the instructions. There's also `certutil.exe`, but there's a GUI option, so it's easier than trying to wrangle a windows shell. It's installed in a system store, so it'll work pretty much anywhere.
