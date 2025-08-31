# Contribution guidelines

## Basic guidelines

### Use of generative AI is banned

Generative AI uses training data [based on plagiarism and piracy](https://web.archive.org/web/20250000000000*/https://www.theatlantic.com/technology/archive/2025/03/libgen-meta-openai/682093/), has [significant environmental costs associated with it](https://doi.org/10.21428/e4baedd9.9070dfe7), and [generates fundamentally insecure code](https://doi.org/10.1007/s10664-024-10590-1). GenAI is not ethically built, ethical to use, nor safe to use for programming applications. When caught, you will be permanently banned from contributing to the project, and any prior contributions will be checked and potentially reverted.

### PR and commit meta

PRs should be made to the `master` branch, which is also the main development branch. Releases don't go on a branch, they're tags.

### Aside: Windows and Mac users

Windows and Linux are the only two desktop operating systems receiving active support. Mac does not. This  section contains things to look out for as a result.

MacOS users should probably assume that most things can and will break. If you'd like to fix them, open a PR.

#### Windows-specific issues

Windows lacks support for most of the scripts used to support development. You're on your own with these, as no equivalents will be supported. They can still at least partly be run through git bash, though.

## Development setup

After cloning:
```bash
npm i --include=dev
npm run dev
```

Setting up in an obsidian vault is mostly just a matter of copying the right files to the right directory. Though this can be done manually, two utility scripts have been provided:

* `./scripts/dev.sh` - creates symlinks
* `./scripts/install.sh` - copies the files

The vault location is sourced from `.env.dev`. Before using the scripts, make sure you initialise it:
```bash
cp .env.dev-example .env.dev 
vim .env.dev
```

`.env.dev` is sourced as a bash script, and uses bash syntax.

There's also `./scripts/bundle.sh`, which creates a folder in the repo containing the sources, under `dist/`. You can then copy `dist/obsidian-webdav-sync` to `.obsidian/plugins/obsidian-webdav-sync` manually.

> [!warning]
>
> Do not copy your vault to export it with symlinks enabled. Run `install.sh` to get it to use regular files instead. Otherwise, all other devices will fail to resolve  the symlink, and the plugin will fail to load.

### Testing

Some functionality is tested via jest. Running these tests can be done with `npm run test`. They're also run automatically in the CI when a PR is made.

### Integration testing

The integration tests make up the majority of the tests, as the majority of the functionality requires obsidian available to be reliably tested. These tests are written in python for two major reasons:

1. It gives easier access to copyparty, a fantastic WebDAV server that happens to be written in Python
2. Fuck TypeScript, with a cactus. 

These tests may be harder to run locally, as you need the following installed:

* Python (obviously)
* Obsidian (surprised pikachu)

Plus an npm dependency.

```
# Required for the electron-chromedriver
npm i --include=dev
# Build
npm run build 
# !!!OR!!!
npm run dev
# Both work

# Create dist/obsidian-webdav-sync and move the stuff into it
# This is where the tests look for the plugin for copying into
# the test vault
./scripts/bundle.sh

cd integration-tests
python3 -m venv env 
# This varies by OS and shell
source ./env/bin/activate

pip3 install -r requirements.txt
# Equivalent instructions for windows is left as an exercise to
# the masochistic reader
export OBSIDIAN_LOCATION=$(which obsidian)

python3 -m pytest
```
For Linux users, at least X11 users, you can run `xvfb-run python3 -m pytest` to hide the GUI.

#### Warnings for Windows users

Because Windows is an operating system with a horrible relation to its filesystem, you can and will run into situations where tests fail on file deletions, or fail to fully delete files. If this affects you, delete the files manually and try again. The tests should try to automatically recover from this when detected, but may fail if the files end up being fully locked. Powertoys has a file unlocking tool that might help in this case.

Note that these are primarily test-specific problems that won't affect normal plugin use. The biggest known problem requires the following conditions:

1. A Windows computer
2. A Windows server (possibly on the same computer)
3. A short-lived copyparty instance
4. For copyparty's history cache to be deleted immediately after copyparty is turned off

These conditions are not going to happen in the real world.

## Making changes

This section does not describe how to actually make the changes (it's assumed you know how to code and use git; if you don't, see https://opensource.guide/ ), but describes some pitfalls with certain specific changes.

### Changes to settings

One consequence of the integration tests being written in python rather than TS is that there's no type sync between the tests and the plugin. If you make changes to the settings objects, a corresponding change needs to me made in `integration-test/tests/utils.py`, in the `default_settings` function.

The default settings correspond to the expected default behaviour of the vault, but these may differ from the real default values. For example, the default URL is null, while in `default_settings`, it's set to a test environment-specific URL. If you're unsure about what to set the value to, you can set it to match the default.

## Making a release

(You do not need to follow this unless you're me)

The version has to be bumped in two places:

* `package.json`
* `manifest.json`


There's also a [`versions.json`, described by obsidian](https://docs.obsidian.md/Reference/Versions), but this is not in use yet, as it doesn't seem to be required (plus, nothing has been released yet).

