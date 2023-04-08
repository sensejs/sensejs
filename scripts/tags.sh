#!/bin/sh
pnpm -r --filter './packages/*' exec -- sh -c 'git tag `jq -r .name package.json`@`jq -r .version package.json` || true'
