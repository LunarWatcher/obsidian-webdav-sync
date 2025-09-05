#!/usr/bin/bash

set -e
source .env.dev

if [[ "${VAULT_LOCATION}" == "" ]]; then
    echo "Missing VAULT_LOCATION."
    exit -1
fi

DEST_FOLDER="${VAULT_LOCATION}/.obsidian/plugins/webdav-sync"
mkdir -p "${DEST_FOLDER}/.obsidian/plugins"
mkdir -p "${DEST_FOLDER}"

ln -sf $(pwd)/main.js "${DEST_FOLDER}"
ln -sf $(pwd)/styles.css "${DEST_FOLDER}"
ln -sf $(pwd)/manifest.json "${DEST_FOLDER}"
