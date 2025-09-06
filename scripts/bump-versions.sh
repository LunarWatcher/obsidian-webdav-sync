#!/usr/bin/bash

target_version=$1
if [[ "${target_version}" == "" ]]; then
    echo "Usage: ./scripts/bump-versions.sh 1.2.3"
    exit -1
fi

groot=$(git rev-parse --show-toplevel)
manifest=$groot/manifest.json
package=$groot/package.json

jq_extras="--indent 4"

cat $manifest | jq $jq_extras ".version = \"$target_version\"" | tee $manifest
cat $package | jq $jq_extras ".version = \"$target_version\"" | tee $package

