# Contribution guidelines

## Basic guidelines

### Use of generative AI is banned

Generative AI uses training data [based on plagiarism and piracy](https://web.archive.org/web/20250000000000*/https://www.theatlantic.com/technology/archive/2025/03/libgen-meta-openai/682093/), has [significant environmental costs associated with it](https://doi.org/10.21428/e4baedd9.9070dfe7), and [generates fundamentally insecure code](https://doi.org/10.1007/s10664-024-10590-1). GenAI is not ethically built, ethical to use, nor safe to use for programming applications. When caught, you will be permanently banned from contributing to the project, and any prior contributions will be checked and potentially reverted.

### PR and commit meta

PRs should be made to the `master` branch, which is also the main development branch. Releases don't go on a branch, they're tags.

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

## Making a release

(You do not need to follow this unless you're me)

The version has to be bumped in two places:

* `package.json`
* `manifest.json`


There's also a [`versions.json`, described by obsidian](https://docs.obsidian.md/Reference/Versions), but this is not in use yet, as it doesn't seem to be required.

