#!/bin/sh
if [[ ! -n $HUSKY_GIT_PARAMS ]]; then
  exit 1
fi
echo $HUSKY_GIT_PARAMS | (
  read PREV CURR FLAG
  if [[ $PREV != $CURR ]]; then
    pnpm m i
  fi
)
