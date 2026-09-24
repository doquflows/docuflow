#!/usr/bin/env bash
set -e

echo "Docuflow Pre-Release Check"
echo "=========================="

PASS=0
FAIL=0

check() {
  local label="$1"
  local result="$2"
  if [ "$result" = "pass" ]; then
    echo "  PASS: $label"
    PASS=$((PASS+1))
  else
    echo "  FAIL: $label"
    FAIL=$((FAIL+1))
  fi
}

# ── 1. Secrets & sensitive files ─────────────────────────────────────────────

if git ls-files --error-unmatch .env 2>/dev/null; then
  check ".env not tracked in git" "fail"
else
  check ".env not tracked in git" "pass"
fi

if git ls-files | grep -q '\.db$'; then
  check "No .db files tracked in git" "fail"
else
  check "No .db files tracked in git" "pass"
fi

if git ls-files | grep -q 'watch\.pid$'; then
  check "watch.pid not tracked in git" "fail"
else
  check "watch.pid not tracked in git" "pass"
fi

if git log --all --oneline -p -- "*.ts" "*.js" 2>/dev/null | \
  grep -v "WAYMARK_SLACK_WEBHOOK_URL\|YOUR_TOKEN\|placeholder\|example\|sk-ant-example\|sk-ant-test\|ANTHROPIC_API_KEY env\|ANTHROPIC_API_KEY for\|ANTHROPIC_API_KEY — " | \
  grep -qE "sk-ant-[A-Za-z0-9]{36}|npm_[A-Za-z0-9]{36}"; then
  check "No actual secrets in git history" "fail"
else
  check "No actual secrets in git history" "pass"
fi

# ── 2. Core build (server + cli) ─────────────────────────────────────────────

echo ""
echo "Running core build (server + cli)..."
if npm run build -w packages/server -w packages/cli 2>&1 | grep -q "error TS"; then
  check "TypeScript build succeeds for server + cli (0 errors)" "fail"
else
  check "TypeScript build succeeds for server + cli (0 errors)" "pass"
fi

# ── 3. Required files ─────────────────────────────────────────────────────────

echo ""
echo "Checking required files..."
for f in README.md LICENSE CHANGELOG.md FEATURES.md; do
  [ -f "$f" ] && check "$f exists" "pass" || check "$f exists" "fail"
done

for f in release/README.md release/CHANGELOG.md; do
  [ -f "$f" ] && check "$f exists" "pass" || check "$f exists" "fail"
done

# ── 4. Compiled dist files (CLI commands) ────────────────────────────────────

echo ""
echo "Checking compiled dist files..."
for cmd in init init-interactive status suggest watch watch-stop sync review update ui start; do
  f="packages/cli/dist/commands/${cmd}.js"
  [ -f "$f" ] && check "dist: ${cmd}.js compiled" "pass" || check "dist: ${cmd}.js compiled" "fail"
done

for f in packages/server/dist/index.js packages/cli/dist/index.js; do
  [ -f "$f" ] && check "dist: $f exists" "pass" || check "dist: $f exists" "fail"
done

# UI bundle bundled into CLI package
[ -f "packages/cli/ui-dist/index.html" ] \
  && check "CLI ui-dist/index.html bundled" "pass" \
  || check "CLI ui-dist/index.html bundled" "fail"

# ── 5. Package metadata — v2.0 four packages (core, studio, server alias, cli) ─

echo ""
echo "Checking package metadata..."

CORE_NAME=$(node   -e "console.log(require('./packages/core/package.json').name)")
STUDIO_NAME=$(node -e "console.log(require('./packages/studio/package.json').name)")
SERVER_NAME=$(node -e "console.log(require('./packages/server/package.json').name)")
CLI_NAME=$(node    -e "console.log(require('./packages/cli/package.json').name)")
[ "$CORE_NAME"   = "@doquflow/core"   ] \
  && check "packages/core name = @doquflow/core"   "pass" \
  || check "packages/core name = @doquflow/core"   "fail"
[ "$STUDIO_NAME" = "@doquflow/studio" ] \
  && check "packages/studio name = @doquflow/studio" "pass" \
  || check "packages/studio name = @doquflow/studio" "fail"
[ "$SERVER_NAME" = "@doquflow/server" ] \
  && check "packages/server name = @doquflow/server" "pass" \
  || check "packages/server name = @doquflow/server" "fail"
[ "$CLI_NAME"    = "@doquflow/cli"    ] \
  && check "packages/cli name = @doquflow/cli"    "pass" \
  || check "packages/cli name = @doquflow/cli"    "fail"

CORE_VER=$(node   -e "console.log(require('./packages/core/package.json').version)")
STUDIO_VER=$(node -e "console.log(require('./packages/studio/package.json').version)")
SRV_VER=$(node    -e "console.log(require('./packages/server/package.json').version)")
CLI_VER=$(node    -e "console.log(require('./packages/cli/package.json').version)")

[ "$CORE_VER" = "$STUDIO_VER" ] \
  && check "core and studio versions match ($CORE_VER)" "pass" \
  || check "core and studio versions match (core=$CORE_VER, studio=$STUDIO_VER)" "fail"

[ "$STUDIO_VER" = "$SRV_VER" ] \
  && check "studio and server versions match ($STUDIO_VER)" "pass" \
  || check "studio and server versions match (studio=$STUDIO_VER, srv=$SRV_VER)" "fail"

[ "$CLI_VER" = "$SRV_VER" ] \
  && check "cli and server versions match ($CLI_VER)" "pass" \
  || check "cli and server versions match (cli=$CLI_VER, srv=$SRV_VER)" "fail"

# ── 6. No stale package name ──────────────────────────────────────────────────

if grep -r "docuflow-mcp" packages/ --include="*.ts" --include="*.js" 2>/dev/null \
  | grep -v "node_modules" | grep -q .; then
  check "No stale docuflow-mcp references in source" "fail"
else
  check "No stale docuflow-mcp references in source" "pass"
fi

# ── 7. Smoke tests — CLI commands ────────────────────────────────────────────

echo ""
echo "Running CLI smoke tests..."

if node packages/cli/dist/index.js sync --no-lint --quiet 2>/dev/null; then
  check "docuflow sync --no-lint --quiet exits 0" "pass"
else
  check "docuflow sync --no-lint --quiet exits 0" "fail"
fi

if node packages/cli/dist/index.js watch status 2>/dev/null | grep -q "stopped\|running"; then
  check "docuflow watch status exits 0 and prints state" "pass"
else
  check "docuflow watch status exits 0 and prints state" "fail"
fi

if node packages/cli/dist/index.js watch stop 2>/dev/null; then
  check "docuflow watch stop (no daemon) exits 0 gracefully" "pass"
else
  check "docuflow watch stop (no daemon) exits 0 gracefully" "fail"
fi

# Core help check (v1.7 core/advanced split — top-level shows core only)
HELP=$(node packages/cli/dist/index.js 2>&1)
for cmd in "init" "ingest" "query" "status" "rewiki" "ADVANCED"; do
  echo "$HELP" | grep -qe "$cmd" \
    && check "core help contains: $cmd" "pass" \
    || check "core help contains: $cmd" "fail"
done

# Advanced help check — full advanced surface visible under `advanced --help`
ADV_HELP=$(node packages/cli/dist/index.js advanced --help 2>&1)
for cmd in "watch" "sync" "ui" "review" "recent" "suggest" "update" "Alias for"; do
  echo "$ADV_HELP" | grep -qe "$cmd" \
    && check "advanced help contains: $cmd" "pass" \
    || check "advanced help contains: $cmd" "fail"
done

# Bright line — every old top-level command path still works
if node packages/cli/dist/index.js watch status 2>/dev/null | grep -q "stopped\|running"; then
  check "bare-form 'watch status' still works (bright line)" "pass"
else
  check "bare-form 'watch status' still works (bright line)" "fail"
fi
if node packages/cli/dist/index.js advanced watch status 2>/dev/null | grep -q "stopped\|running"; then
  check "'advanced watch status' also works" "pass"
else
  check "'advanced watch status' also works" "fail"
fi

# review behavioral checks (required acceptance scenarios)
echo ""
echo "Running review behavioral checks..."
REVIEW_TMP_DIR=$(mktemp -d)
REPO_ROOT=$(pwd)
cleanup_review_tmp() {
  rm -rf "$REVIEW_TMP_DIR"
}
trap cleanup_review_tmp EXIT

cd "$REVIEW_TMP_DIR"
git init -q
git config user.email "pre-release@example.com"
git config user.name "Pre Release Check"

printf "base\n" > base.txt
git add base.txt
git commit -q -m "base"
BASE_REF=$(git rev-parse HEAD)

set +e
EMPTY_OUT=$(node "$REPO_ROOT/packages/cli/dist/index.js" review --quiet 2>&1)
EMPTY_STATUS=$?
set -e
if [ "$EMPTY_STATUS" -eq 0 ] && echo "$EMPTY_OUT" | grep -qi "nothing to review"; then
  check "review empty diff exits 0" "pass"
else
  check "review empty diff exits 0" "fail"
fi

set +e
BAD_REF_OUT=$(node "$REPO_ROOT/packages/cli/dist/index.js" review --since-commit DOES_NOT_EXIST --quiet 2>&1)
BAD_REF_STATUS=$?
set -e
if [ "$BAD_REF_STATUS" -eq 2 ]; then
  check "review invalid --since-commit exits 2" "pass"
else
  check "review invalid --since-commit exits 2" "fail"
fi

printf "staged\n" > staged-only.txt
git add staged-only.txt
printf "unstaged\n" > unstaged-only.txt

set +e
STAGED_SCOPE_OUT=$(node "$REPO_ROOT/packages/cli/dist/index.js" review --staged --quiet 2>&1)
STAGED_SCOPE_STATUS=$?
set -e
if [ "$STAGED_SCOPE_STATUS" -eq 0 ] \
  && echo "$STAGED_SCOPE_OUT" | grep -q "staged-only.txt" \
  && ! echo "$STAGED_SCOPE_OUT" | grep -q "unstaged-only.txt"; then
  check "review --staged scopes to staged files only" "pass"
else
  check "review --staged scopes to staged files only" "fail"
fi

git commit -q -m "add staged-only"
printf "since\n" > since-only.txt
git add since-only.txt
git commit -q -m "add since-only"
printf "working\n" > working-only.txt

set +e
SINCE_SCOPE_OUT=$(node "$REPO_ROOT/packages/cli/dist/index.js" review --since-commit "$BASE_REF" --quiet 2>&1)
SINCE_SCOPE_STATUS=$?
set -e
if [ "$SINCE_SCOPE_STATUS" -eq 0 ] \
  && echo "$SINCE_SCOPE_OUT" | grep -q "since-only.txt" \
  && ! echo "$SINCE_SCOPE_OUT" | grep -q "working-only.txt"; then
  check "review --since-commit scopes to commit range only" "pass"
else
  check "review --since-commit scopes to commit range only" "fail"
fi

printf "const token = \"abcd1234\";\n" > critical.ts
git add critical.ts

set +e
node "$REPO_ROOT/packages/cli/dist/index.js" review --staged --fail-on-critical --quiet >/dev/null 2>&1
FAIL_CRITICAL_STATUS=$?
set -e
if [ "$FAIL_CRITICAL_STATUS" -eq 1 ]; then
  check "review --fail-on-critical exits 1 on critical findings" "pass"
else
  check "review --fail-on-critical exits 1 on critical findings" "fail"
fi

cd "$REPO_ROOT"

set +e
AI_OUT=$(node "$REPO_ROOT/packages/cli/dist/index.js" review --ai --quiet 2>&1)
AI_STATUS=$?
set -e
if [ "$AI_STATUS" -eq 0 ] && (echo "$AI_OUT" | grep -qi "copilot\|unavailable\|review" || echo "$AI_OUT" | grep -q "Summary"); then
  check "review --ai mode works or falls back gracefully" "pass"
else
  check "review --ai mode works or falls back gracefully" "fail"
fi

# ── 8. Tool count in server ───────────────────────────────────────────────────

echo ""
echo "Checking MCP tool count..."
TOOL_COUNT_RAW=$(echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | node packages/server/dist/index.js 2>/dev/null \
  | node -e "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(d.result.tools.length)}catch(e){console.log(0)}")
# Strip ANSI color codes that may leak from the server's stdout banner
TOOL_COUNT=$(echo "$TOOL_COUNT_RAW" | sed -E 's/\x1b\[[0-9;]*m//g' | tr -cd '0-9')
[ -z "$TOOL_COUNT" ] && TOOL_COUNT=0
[ "$TOOL_COUNT" -ge 15 ] \
  && check "MCP server registers ≥15 tools (found $TOOL_COUNT)" "pass" \
  || check "MCP server registers ≥15 tools (found $TOOL_COUNT)" "fail"

# ── 9. Schema.md not a placeholder ───────────────────────────────────────────

echo ""
echo "Checking schema.md..."
if grep -q "\[Edit this file to customize your wiki\]" .docuflow/schema.md 2>/dev/null; then
  check "schema.md is not a placeholder (fill in .docuflow/schema.md)" "fail"
else
  check "schema.md is not a placeholder" "pass"
fi

# ── 10. UI + API type-checks and production build ─────────────────────────────

echo ""
echo "Checking UI and API builds..."

# UI: TypeScript strict check
if node_modules/.bin/tsc --noEmit -p packages/studio/tsconfig.json 2>&1 | grep -q "error TS"; then
  check "UI TypeScript strict check (0 errors)" "fail"
else
  check "UI TypeScript strict check (0 errors)" "pass"
fi

# UI: production build (vite)
UI_BUILD_OUT=$(node_modules/.bin/vite build packages/studio 2>&1)
if echo "$UI_BUILD_OUT" | grep -qE "error|Error|failed"; then
  check "UI production build succeeds (vite build)" "fail"
else
  check "UI production build succeeds (vite build)" "pass"
fi

# UI: dist/index.html produced
[ -f "packages/studio/ui-dist/index.html" ] \
  && check "UI dist/index.html produced" "pass" \
  || check "UI dist/index.html produced" "fail"

# API: TypeScript strict check
if node_modules/.bin/tsc --noEmit -p packages/studio/tsconfig.mcp.json 2>&1 | grep -q "error TS"; then
  check "API TypeScript strict check (0 errors)" "fail"
else
  check "API TypeScript strict check (0 errors)" "pass"
fi

# API: source file exists
[ -f "packages/studio/src/api/index.ts" ] \
  && check "packages/studio/src/api/index.ts exists" "pass" \
  || check "packages/studio/src/api/index.ts exists" "fail"

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "=========================="
echo "Checks:  $((PASS+FAIL)) total"
echo "Passed:  $PASS"
echo "Failed:  $FAIL"
echo "=========================="

if [ "$FAIL" -eq 0 ]; then
  echo "RESULT: PASSED — safe to release"
else
  echo "RESULT: FAILED — $FAIL check(s) failed"
  exit 1
fi
