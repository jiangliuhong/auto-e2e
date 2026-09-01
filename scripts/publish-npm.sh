#!/usr/bin/env bash
# Build, validate, and publish auto-e2e to the public npm registry.
#
# Usage:
#   npm run publish:npm -- --dry-run
#   npm run publish:npm
#   npm run publish:npm -- --tag next

set -euo pipefail

cd "$(dirname "$0")/.."

REGISTRY="https://registry.npmjs.org"
TAG="latest"
DRY_RUN=false
ALLOW_DIRTY=false

usage() {
  cat <<'EOF'
Usage: scripts/publish-npm.sh [options]

Build, test, inspect, and publish the package to npmjs.com.

Options:
  --dry-run       Run every local check and npm pack, but do not publish.
  --tag <tag>     Publish under an npm dist-tag (default: latest).
  --allow-dirty   Allow publishing with uncommitted Git changes.
  -h, --help      Show this help message.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --tag)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then
        printf 'Error: --tag requires a value.\n' >&2
        exit 2
      fi
      TAG="$2"
      shift 2
      ;;
    --allow-dirty)
      ALLOW_DIRTY=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Error: unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ -t 1 ]; then
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  CYAN='\033[0;36m'
  RESET='\033[0m'
else
  GREEN=''; RED=''; CYAN=''; RESET=''
fi

info() { printf "${CYAN}▶${RESET} %s\n" "$*"; }
ok()   { printf "${GREEN}✓${RESET} %s\n" "$*"; }
fail() { printf "${RED}✗${RESET} %s\n" "$*" >&2; }

for command_name in node npm git; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    fail "Required command not found: $command_name"
    exit 1
  fi
done

PACKAGE_NAME="$(node -p "require('./package.json').name")"
PACKAGE_VERSION="$(node -p "require('./package.json').version")"
PACKAGE_PRIVATE="$(node -p "Boolean(require('./package.json').private)")"

if [ -z "$PACKAGE_NAME" ] || [ -z "$PACKAGE_VERSION" ]; then
  fail 'package.json must contain name and version.'
  exit 1
fi
if [ "$PACKAGE_PRIVATE" = 'true' ]; then
  fail "$PACKAGE_NAME is marked private and cannot be published."
  exit 1
fi

info "Preparing ${PACKAGE_NAME}@${PACKAGE_VERSION} (tag: ${TAG})"

if [ "$DRY_RUN" = false ] && [ "$ALLOW_DIRTY" = false ] && [ -n "$(git status --porcelain)" ]; then
  fail 'The Git working tree is not clean. Commit/stash changes or pass --allow-dirty.'
  exit 1
fi

if [ "$DRY_RUN" = false ]; then
  info 'Checking npmjs.com authentication'
  NPM_USER="$(npm whoami --registry "$REGISTRY")"
  ok "Authenticated as ${NPM_USER}"

  set +e
  PUBLISHED_LOOKUP="$(npm view "${PACKAGE_NAME}@${PACKAGE_VERSION}" version --registry "$REGISTRY" 2>&1)"
  LOOKUP_STATUS=$?
  set -e
  if [ "$LOOKUP_STATUS" -eq 0 ]; then
    fail "${PACKAGE_NAME}@${PACKAGE_VERSION} already exists on npmjs.com."
    exit 1
  fi
  case "$PUBLISHED_LOOKUP" in
    *E404*) ;;
    *)
      fail "Could not check ${PACKAGE_NAME}@${PACKAGE_VERSION} on npmjs.com: ${PUBLISHED_LOOKUP}"
      exit 1
      ;;
  esac
fi

info 'Installing dependencies from package-lock.json'
npm ci

info 'Running type checks'
npm run typecheck

info 'Running tests'
npm test

info 'Building distribution files'
npm run build

info 'Inspecting the package tarball'
npm pack --dry-run

if [ "$DRY_RUN" = true ]; then
  ok "Dry run complete for ${PACKAGE_NAME}@${PACKAGE_VERSION}; nothing was published."
  exit 0
fi

info "Publishing ${PACKAGE_NAME}@${PACKAGE_VERSION} to npmjs.com"
npm publish --access public --tag "$TAG" --registry "$REGISTRY"

PUBLISHED_VERSION="$(npm view "${PACKAGE_NAME}@${PACKAGE_VERSION}" version --registry "$REGISTRY")"
if [ "$PUBLISHED_VERSION" != "$PACKAGE_VERSION" ]; then
  fail "Publish returned successfully, but registry verification returned ${PUBLISHED_VERSION}."
  exit 1
fi

ok "Published ${PACKAGE_NAME}@${PACKAGE_VERSION} with dist-tag ${TAG}."
