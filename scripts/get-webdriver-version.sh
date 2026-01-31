#!/usr/bin/bash

cat ${OBSIDIAN_BIN:-/usr/bin/obsidian} | sed -nE "s/.*Chrome\/([0-9]+).*/\1/p" | head -n 1
