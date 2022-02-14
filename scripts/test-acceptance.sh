#!/usr/bin/env bash

if [[ ! -d dist ]]; then
  ./scripts/build.sh
fi

cleanup() {
  rm -rf node_modules/ugraph
  mv package.json.ignore package.json
  mv dist/package.json.ignore dist/package.json
}

trap "cleanup" EXIT

mkdir -p node_modules/ugraph
cp -r dist/* node_modules/ugraph
mv package.json package.json.ignore
mv dist/package.json dist/package.json.ignore

cd $(dirname $0)/..

# filter to only acceptance, remove ignore pattern set in config
./scripts/test.sh --testRegex=acceptance --testPathIgnorePatterns=
