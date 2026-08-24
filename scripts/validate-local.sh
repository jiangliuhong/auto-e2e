#!/usr/bin/env bash
set -euo pipefail

VALIDATION_MODE="${1:-}"
if [[ -n "$VALIDATION_MODE" && "$VALIDATION_MODE" != "--real" ]]; then
  echo "usage: ./scripts/validate-local.sh [--real]" >&2
  exit 2
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( NODE_MAJOR < 22 )); then
  echo "Node.js 22 or newer is required" >&2
  exit 2
fi

npm run typecheck
npm test
npm run build
test -f dist/agent/prompts/analyze-requirement.md
test -f dist/agent/knowledge/login.md

VALIDATION_TMP="$(mktemp -d)"
DEMO_PID=""
cleanup() {
  STATUS="$?"
  if (( STATUS != 0 )); then
    test -f "$VALIDATION_TMP/demo.log" && { echo "demo log:" >&2; tail -50 "$VALIDATION_TMP/demo.log" >&2; }
    test -f "$VALIDATION_TMP/first.json" && { echo "first verify:" >&2; cat "$VALIDATION_TMP/first.json" >&2; }
    test -f "$VALIDATION_TMP/second.json" && { echo "second verify:" >&2; cat "$VALIDATION_TMP/second.json" >&2; }
  fi
  if [[ -n "$DEMO_PID" ]]; then
    kill "$DEMO_PID" 2>/dev/null || true
    wait "$DEMO_PID" 2>/dev/null || true
  fi
  rm -rf "$VALIDATION_TMP"
  return "$STATUS"
}
trap cleanup EXIT

cp -R examples/demo-app/. "$VALIDATION_TMP/"
ln -s "$PWD/node_modules" "$VALIDATION_TMP/node_modules"
PORT="$(node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
MODE="mock"
if [[ "$VALIDATION_MODE" == "--real" ]]; then MODE="real"; fi
node scripts/prepare-validation-fixture.mjs "$VALIDATION_TMP" "$PORT" "$MODE"
if [[ "$VALIDATION_MODE" == "--real" ]]; then
  node -e "Promise.all([import('@earendil-works/pi-coding-agent')])"
  node dist/cli.js --project-root "$VALIDATION_TMP" --non-interactive --json auth login \
    >"$VALIDATION_TMP/auth.json"
fi

PORT="$PORT" node "$VALIDATION_TMP/server.mjs" >"$VALIDATION_TMP/demo.log" 2>&1 &
DEMO_PID="$!"

for _ in {1..50}; do
  if node -e "fetch('http://127.0.0.1:$PORT/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then break; fi
  sleep 0.1
done

node dist/cli.js --project-root "$VALIDATION_TMP" --non-interactive --json verify >"$VALIDATION_TMP/first.json"
node dist/cli.js --project-root "$VALIDATION_TMP" --non-interactive --json verify >"$VALIDATION_TMP/second.json"
node scripts/check-validation.mjs "$VALIDATION_TMP" "$VALIDATION_TMP/first.json" "$VALIDATION_TMP/second.json"
if [[ "$VALIDATION_MODE" == "--real" ]]; then
  node scripts/run-real-benchmark.mjs "$VALIDATION_TMP" "$PWD/dist/cli.js"
fi
