#!/usr/bin/bash

obsidian=${OBSIDIAN_LOCATION:-/usr/bin/obsidian}

if cat $obsidian | grep -aoE '^exec electron[0-9]+ /usr/lib/obsidian/app.asar' > /dev/null;
then
    # Arch workaround
    match=$(cat $obsidian | grep -aoE '^exec electron[0-9]+' | grep -aoE '[0-9]+')
    obsidian="/usr/lib/electron$match/electron"
fi
# TODO: why did sed -nE 's/.*Chrome\/([0-9]+).*/\1/p' break with obsidian 1.13?
cat $obsidian | grep -aoE 'Chrome/[0-9]+.' | grep -aoE '[0-9]+' | head -n 1

