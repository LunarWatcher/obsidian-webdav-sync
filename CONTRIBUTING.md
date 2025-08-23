# Contribution guidelines

## Basic guidelines

### Use of generative AI is banned

Generative AI uses training data [based on plagiarism and piracy](https://web.archive.org/web/20250000000000*/https://www.theatlantic.com/technology/archive/2025/03/libgen-meta-openai/682093/), has [significant environmental costs associated with it](https://doi.org/10.21428/e4baedd9.9070dfe7), and [generates fundamentally insecure code](https://doi.org/10.1007/s10664-024-10590-1). GenAI is not ethically built, ethical to use, nor safe to use for programming applications. When caught, you will be permanently banned from contributing to the project, and any prior contributions will be checked and potentially reverted.

## Development setup

After cloning:
```
npm i --include=dev
npm run dev
```

Setup in an obsidian vault can be done fairly easily with
```
# From  your vault root folder
cd .obsidian
mkdir obsidian-webdav-sync && cd obsidian-webdav-sync
ln -sf /path/to/development/folder/for/obsidian-webdav-sync/{main.js,styles.css,manifest.json} .
```
