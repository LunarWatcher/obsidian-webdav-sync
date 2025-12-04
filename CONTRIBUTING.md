# Contribution guidelines

## Basic guidelines

### Use of generative AI is banned

Generative AI uses training data [based on plagiarism and piracy](https://web.archive.org/web/20250000000000*/https://www.theatlantic.com/technology/archive/2025/03/libgen-meta-openai/682093/), has [significant environmental costs associated with it](https://doi.org/10.21428/e4baedd9.9070dfe7), and [generates fundamentally insecure code](https://doi.org/10.1007/s10664-024-10590-1). GenAI is not ethically built, ethical to use, nor safe to use for programming applications. When caught, you will be permanently banned from contributing to the project, and any prior contributions will be checked and potentially reverted. Any and all contributions you've made cannot be trusted if AI slop machines were involved.

### PR and commit meta

PRs should be made to the `master` branch, which is also the main development branch. Releases don't go on a branch, they're tags.

### Aside: Windows and Mac users

Windows and Linux are the only two desktop operating systems receiving active support. Mac does not. This  section contains things to look out for as a result.

MacOS users should probably assume that most things can and will break. If you'd like to fix them, open a PR.

#### Windows-specific issues

Windows lacks support for most of the scripts used to support development. You're on your own with these, as no equivalents will be supported. They can still at least partly be run through git bash, though.

Additionally, the integration tests will take at least `10 * ${test_count}` seconds longer to complete than on Linux, due to special delays that need to be in place for windows not to quietly fail. This is caused by weird Popen startup shit that does not make sense from my perspective as a user of a real operating system. Linux mostly does not have equivalent delays, and if it does, those are mostly 1-2 seconds to deal with race conditions, and are actually present everywhere.

### Testing guidelines

As far as reasonably possible, as much code as possible should be tested. 100% coverage is not the goal here (nor is 100% cover realistically achievable), but covering the major, critical parts of the plugin means it's easier to be sure stuff doesn't violently break when making changes.

Testing is grossly underappreciated in far too many places in the software development sector. While this plugin isn't exactly load-bearing infrastructure, every single test failure is one less problem for end-users to report.

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

There's also `./scripts/bundle.sh`, which creates a folder in the repo containing the sources, under `dist/`. You can then copy `dist/webdav-sync` to `.obsidian/plugins/webdav-sync` manually.

> [!warning]
>
> Do not copy your vault to export it with symlinks enabled. Run `install.sh` to get it to use regular files instead. Otherwise, all other devices will fail to resolve  the symlink, and the plugin will fail to load.

### Testing

Some functionality is tested via jest. Running these tests can be done with `npm run test`. They're also run automatically in the CI when a PR is made.

When writing code, anything that can be  tested standalone without any obsidian APIs being involved can go in this file. Obsidian's runtime is unfortunately fully private and proprietary, so those cannot be accessed in unit tests without writing an entire mock suite first, and fuck that.

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

# Create dist/webdav-sync and move the stuff into it
# This is where the tests look for the plugin for copying into
# the test vault
# This needs to be done every time there's changes to the plugin files.
# For Linux users, a script has been provided that does this before
# running the tests. See the text after this code block.
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
For Linux users, at least X11 users, you can run `xvfb-run python3 -m pytest` to hide the GUI. For this particular scenario, a utility script has been provided. Once the venv is set up and dependencies are installed, you can run `./scripts/e2e-test.sh`, which will re-bundle the plugin and run the tests with `xvfb-run`. This also means no manual commands need to be run to re-bundle the plugin after changes, and lets the integration tests be run from the git root.

The script forwards arguments to pytest. If you want to run a single test, for example, you can run `./scripts/e2e-test.sh -k test_push_wipe_blocked`.

#### Screenshots

At strategic points during the tests, some tests take screenshots. These are output into `<git root>/integration-test/_screenshots/<test name>/<identifier>`.

These are primarily taken to aid with debugging of test failures. 

Note that the screenshots folder is never deleted, so if the code creating a given screenshot is removed, the screenshot files stay around. This is actually a feature, and in compatible image viewers, result in the opened images automatically being refreshed. XViewer is one such known example. 

##### Taking screenshots

```python
def test_whatever(obsidian: Chrome, screenshotter):
    do_whatever()
    # Note that an extension is not needed, and is added automatically
    # when the screenshot is taken
    screenshotter("Some identifier for the file - doesn't have to be globally unique, only unique for the test")
```

There's no specific rule for when a screenshot is needed. Don't take too many, and if any end up missing, they can be added as needed. If you're unsure, don't take any screenshots altogether.

#### Warnings for Windows users

Because Windows is an operating system with a horrible relation to its filesystem, you can and will run into situations where tests fail on file deletions, or fail to fully delete files. If this affects you, delete the files manually and try again. The tests should try to automatically recover from this when detected, but may fail if the files end up being fully locked. Powertoys has a file unlocking tool that might help in this case.

Note that these are primarily test-specific problems that won't affect normal plugin use. The biggest known problem requires the following conditions:

1. A Windows computer
2. A Windows server (possibly on the same computer)
3. A short-lived copyparty instance
4. For copyparty's history cache to be deleted immediately after copyparty is turned off

These conditions are not going to happen in the real world.

## Supporting Zellij layouts

There's a [Zellij](https://zellij.dev/) layout available for development. You can run it with:
```
zellij -n ./dev/zellij/default.kdl
```

The layout runs integration tests, unit tests, and `npm run dev`, so the majority of actions needed.

(This can also be done in a much shorter command with [umbra](https://github.com/LunarWatcher/umbra): `umbra z`)

## Making changes

This section does not describe how to actually make the changes (it's assumed you know how to code and use git; if you don't, see https://opensource.guide/ ), but describes some pitfalls with certain specific changes.

### Changes to settings

One consequence of the integration tests being written in python rather than TS is that there's no type sync between the tests and the plugin. If you make changes to the settings objects, a corresponding change needs to me made in `integration-test/tests/utils.py`, in the `default_settings` function.

The default settings correspond to the expected default behaviour of the vault, but these may differ from the real default values. For example, the default URL is null, while in `default_settings`, it's set to a test environment-specific URL. If you're unsure about what to set the value to, you can set it to match the default.

### Comment standard

For comments, doxygen syntax is used. Doxygen documentation is not currently generated, largely because this isn't a library, but the standard just makes it easier to write comments that are structurally similar.

This applies to both TypeScript and Python. In Python, the `"""` doc blocks are still used. Support for this in doxygen is a bit weird, but because no docs are actually generated, this doesn't matter. To use the special backslash commands, use `r"""`.

## Making a release

(You do not need to follow this unless you're me)

The version has to be bumped in two places:

* `package.json`
* `manifest.json`

There's also a [`versions.json`, described by obsidian](https://docs.obsidian.md/Reference/Versions), but this is not in use yet, as it doesn't seem to be required (plus, nothing has been released yet, and I do not have a way to make it useful, as I'll mostly be operating on the latest versions).
