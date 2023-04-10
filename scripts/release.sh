#!/bin/bash

case "$1" in
"alpha" | "beta" | "rc" | "latest")
  pnpm -r publish --tag "$1"
  ;;
*)
  echo "Usage: $0 <alpha|beta|rc|latest>"
esac





