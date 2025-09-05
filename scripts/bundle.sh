#!/usr/bin/bash

DEST=dist/webdav-sync
mkdir -p dist
mkdir -p $DEST

cp main.js $DEST
cp styles.css $DEST
cp manifest.json $DEST
