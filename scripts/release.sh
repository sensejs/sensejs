# First dry run to change all package version
DIST_TAG=$2
if [[ -n "$DIST_TAG" ]]; then
  DIST_TAG="--tag=$DIST_TAG"
fi
pnpm recursive run cleanup
pnpm recursive run prepare
pnpm recursive --workspace-concurrency 1 --filter ./packages exec \
  -- pnpm version --no-git-tag-version $1
ALL_VERSIONS=`pnpm recursive ls --depth=-1 | cut -d ' ' -f 1 | tr '\n' ' '`;
pnpm recursive update $ALL_VERSIONS
pnpm recursive --no-bail --workspace-concurrency=1 exec -- pnpm publish $DIST_TAG
