#!/usr/bin/bash

git_root=$(git rev-parse --show-toplevel)

cd ${git_root}
${git_root}/scripts/bundle.sh
cd ${git_root}/integration-test

source ./env/bin/activate
xvfb-run python3 -m pytest $@
