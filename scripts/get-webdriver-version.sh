#!/usr/bin/bash

# TODO: why did sed -nE 's/.*Chrome\/([0-9]+).*/\1/p' break with obsidian 1.13?
cat ${OBSIDIAN_BIN:-/usr/bin/obsidian} | grep -aoE 'Chrome/[0-9]+.' | grep -aoE '[0-9]+' | head -n 1
