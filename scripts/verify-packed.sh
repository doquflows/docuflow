#!/usr/bin/env bash
# verify-packed.sh — CRITICAL VERIFICATION RULE
#
# Installs @doquflow/{core,studio,cli} from npm pack tarballs into a temp
# prefix and verifies that 'docuflow ui' starts and correctly loads core
# tools (query-wiki, wiki-search, ingest-source) against the three sibling
# projects: waymark, teststop, devloop.
#
# WHY: DEF-11 escaped because the workspace build resolves @doquflow/core
# via the monorepo node_modules symlink, masking the missing exports entry.
# Only a packed install (no symlinks, real npm resolution) reproduces the
# failure. This script enforces that gate before every release.
#
# Usage:
#   bash scripts/verify-packed.sh
#
# Requirements:
#   - node + npm in PATH
#   - sibling projects at ../waymark  ../teststop  ../devloop
#   - each sibling must have a .docuflow/ wiki (run docuflow init first)

set -uo pipefail   # -e intentionally omitted: curl/python exits non-zero mid-checks

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIBLING_ROOT="$(dirname "$REPO_ROOT")"
TEMP_PREFIX="$(mktemp -d /tmp/docuflow-verify-XXXXXX)"
PACK_DIR="$(mktemp -d /tmp/docuflow-packs-XXXXXX)"
PORT=48830  # non-default port to avoid colliding with a running instance

cleanup() {
  lsof -ti:"$PORT" 2>/dev/null | xargs kill 2>/dev/null || true
  rm -rf "$TEMP_PREFIX" "$PACK_DIR"
}
trap cleanup EXIT

pass=0
fail=0
skip=0

ok()  { echo "  ✓ $*"; ((pass++)) || true; }
err() { echo "  ✗ $*"; ((fail++)) || true; }
skp() { echo "  ⚠ $*  (skipped)"; ((skip++)) || true; }

echo ""
echo "DocuFlow packed-install verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Build all packages ─────────────────────────────────────────────────────
echo ""
echo "→ Building packages..."
cd "$REPO_ROOT"
npm run build --workspaces --if-present 2>&1 | grep -E "error TS|✓|Warning|built in" | head -20 || true
echo "  Build complete."

# ── 2. Pack ───────────────────────────────────────────────────────────────────
echo ""
echo "→ Packing @doquflow/{core,studio,cli}..."
cd "$REPO_ROOT/packages/core"   && npm pack --pack-destination "$PACK_DIR" --quiet
cd "$REPO_ROOT/packages/studio" && npm pack --pack-destination "$PACK_DIR" --quiet
cd "$REPO_ROOT/packages/cli"    && npm pack --pack-destination "$PACK_DIR" --quiet

CORE_TGZ=$(ls "$PACK_DIR"/doquflow-core-*.tgz 2>/dev/null | head -1)
STUDIO_TGZ=$(ls "$PACK_DIR"/doquflow-studio-*.tgz 2>/dev/null | head -1)
CLI_TGZ=$(ls "$PACK_DIR"/doquflow-cli-*.tgz 2>/dev/null | head -1)

for tgz in "$CORE_TGZ" "$STUDIO_TGZ" "$CLI_TGZ"; do
  [[ -f "$tgz" ]] || { echo "  ✗ Pack not found: $tgz"; exit 1; }
  echo "  Packed: $(basename "$tgz")"
done

# ── 3. Install all three tarballs in ONE npm call ─────────────────────────────
# Single call so npm resolves @doquflow/studio → @doquflow/core@2.0.3 from the
# provided tarballs instead of the registry (not yet published).
echo ""
echo "→ Installing into temp prefix: $TEMP_PREFIX"
npm install -g --prefix "$TEMP_PREFIX" "$CORE_TGZ" "$STUDIO_TGZ" "$CLI_TGZ" 2>&1 \
  | grep -E "added|changed|npm error" | head -5 || true

DOCUFLOW_BIN="$TEMP_PREFIX/bin/docuflow"
[[ -x "$DOCUFLOW_BIN" ]] || { echo "  ✗ Binary not found at $DOCUFLOW_BIN"; exit 1; }

INSTALLED_VER=$("$DOCUFLOW_BIN" --version 2>&1 | head -1) || true
echo "  Binary: $INSTALLED_VER"
if [[ ! "$INSTALLED_VER" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
  echo "  ✗ Version check failed: '$INSTALLED_VER'"; exit 1
fi

# Tell prefix-check that the PATH-resolved binary IS this packed binary.
# Prevents direction-2 (DEF-13) shadowing warnings from firing spuriously
# in section 4 (where TEMP_PREFIX is intentionally not on PATH).
# Section 5 tests override this per-case as needed.
export DOCUFLOW_PATH_OVERRIDE_BIN="$DOCUFLOW_BIN"

# ── 4. Per-project checks ─────────────────────────────────────────────────────
for proj in waymark teststop devloop; do
  PROJ_PATH="$SIBLING_ROOT/$proj"
  echo ""
  echo "━━━ $proj ━━━"

  if [[ ! -d "$PROJ_PATH/.docuflow" ]]; then
    skp "$proj: no .docuflow/ — run 'docuflow init' first"
    continue
  fi

  # -- status --
  STATUS_OUT=$(cd "$PROJ_PATH" && "$DOCUFLOW_BIN" status 2>&1) || true
  if echo "$STATUS_OUT" | grep -q "Version:"; then
    ok "status"
  else
    err "status: $STATUS_OUT"
  fi

  # -- docuflow ui (DEF-11 regression gate: core tools must load from packed install) --
  lsof -ti:"$PORT" 2>/dev/null | xargs kill 2>/dev/null || true
  sleep 1

  UI_LOG="$TEMP_PREFIX/${proj}-ui.log"
  DOCUFLOW_PORT=$PORT "$DOCUFLOW_BIN" ui --no-open > "$UI_LOG" 2>&1 &
  UI_PID=$!

  STARTED=0
  for i in $(seq 1 10); do
    sleep 1
    # || true: curl exits non-zero when server not yet up; must not abort script
    PING=$(curl -s "http://localhost:$PORT/api/ping" 2>/dev/null) || true
    if echo "$PING" | grep -q '"ok":true'; then
      STARTED=1; break
    fi
  done

  if [[ $STARTED -eq 0 ]]; then
    err "ui did not start within 10s"
    head -40 "$UI_LOG" 2>/dev/null | sed 's/^/    /'
    kill "$UI_PID" 2>/dev/null || true
    continue
  fi
  ok "ui /api/ping"

  ENC_PATH=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$PROJ_PATH") || true

  # -- /api/ask → query-wiki (core tool — primary DEF-11 check) --
  ASK=$(curl -s -X POST "http://localhost:$PORT/api/ask" \
    -H 'Content-Type: application/json' \
    -d "{\"path\":\"$PROJ_PATH\",\"question\":\"what is this project?\"}" 2>/dev/null) || true
  if echo "$ASK" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'source_pages' in d or 'answer' in d" 2>/dev/null; then
    ok "/api/ask  → query-wiki (core)"
  else
    err "/api/ask: ${ASK:0:200}"
  fi

  # -- /api/search → wiki-search (core tool — secondary DEF-11 check) --
  SEARCH=$(curl -s "http://localhost:$PORT/api/search?path=$ENC_PATH&q=core" 2>/dev/null) || true
  if echo "$SEARCH" | python3 -c "import sys,json; d=json.load(sys.stdin); assert isinstance(d,list) or 'results' in d" 2>/dev/null; then
    ok "/api/search → wiki-search (core)"
  else
    err "/api/search: ${SEARCH:0:200}"
  fi

  # -- /api/wiki → list-wiki (studio tool — confirms studio tools also load) --
  WIKI=$(curl -s "http://localhost:$PORT/api/wiki?path=$ENC_PATH" 2>/dev/null) || true
  if echo "$WIKI" | python3 -c "import sys,json; d=json.load(sys.stdin); assert isinstance(d,list) or 'pages' in d" 2>/dev/null; then
    ok "/api/wiki  → list-wiki (studio)"
  else
    err "/api/wiki: ${WIKI:0:200}"
  fi

  kill "$UI_PID" 2>/dev/null || true
  lsof -ti:"$PORT" 2>/dev/null | xargs kill 2>/dev/null || true
  sleep 1
done

# ── 5. Dual-prefix detection tests (DEF-4 + DEF-13 regression gate) ──────────
# Warning matrix (both directions must be covered):
#   5a. Direction 1 negative: current IS newest, PATH OK        → no warning
#   5b. Direction 1 positive: newer version exists elsewhere     → ⚠ upgrade
#   5c. Direction 2 positive: older install shadows in PATH      → ⚠ remove shadow
#   5d. Direction 2 negative: PATH resolves to active binary     → no warning
#
# DOCUFLOW_CHECK_NOW=1         — bypass the isTTY guard in non-TTY test contexts.
# DOCUFLOW_EXTRA_PREFIXES      — inject fake installs into the scanner.
# DOCUFLOW_PATH_OVERRIDE_BIN   — override the PATH-resolved binary (direction-2 tests).
# Cache is wiped before every probe so each case starts clean.
echo ""
echo "━━━ dual-prefix detection ━━━"

FAKE_PREFIX_OLD="$(mktemp -d /tmp/docuflow-fakeprefix-old-XXXXXX)"
FAKE_PREFIX_NEW="$(mktemp -d /tmp/docuflow-fakeprefix-new-XXXXXX)"
FAKE_PREFIX_SHADOW="$(mktemp -d /tmp/docuflow-fakeprefix-shadow-XXXXXX)"
CACHE_FILE="$HOME/.docuflow/.prefix-check.json"

_fake_install() {
  local prefix="$1" ver="$2"
  mkdir -p "$prefix/lib/node_modules/@doquflow/cli"
  echo "{\"version\":\"$ver\"}" > "$prefix/lib/node_modules/@doquflow/cli/package.json"
}

# 5a. Direction 1 negative: current is newest, PATH resolves to active binary → no warning
_fake_install "$FAKE_PREFIX_OLD" "0.1.0"
rm -f "$CACHE_FILE"
WARN_OUT=$(DOCUFLOW_PATH_OVERRIDE_BIN="$DOCUFLOW_BIN" \
  DOCUFLOW_EXTRA_PREFIXES="$FAKE_PREFIX_OLD" DOCUFLOW_CHECK_NOW=1 \
  "$DOCUFLOW_BIN" status 2>&1 >/dev/null) || true
if echo "$WARN_OUT" | grep -q "⚠"; then
  err "5a: spurious warning when current is newest and PATH is clean"
else
  ok "5a: no warning when current is newest (0.1.0 in extra prefix, no PATH shadow)"
fi

# 5b. Direction 1 positive: newer version (99.0.0) in another prefix → ⚠ upgrade
_fake_install "$FAKE_PREFIX_NEW" "99.0.0"
rm -f "$CACHE_FILE"
WARN_OUT=$(DOCUFLOW_PATH_OVERRIDE_BIN="$DOCUFLOW_BIN" \
  DOCUFLOW_EXTRA_PREFIXES="$FAKE_PREFIX_NEW" DOCUFLOW_CHECK_NOW=1 \
  "$DOCUFLOW_BIN" status 2>&1 >/dev/null) || true
if echo "$WARN_OUT" | grep -q "⚠"; then
  ok "5b: warning fires when newer version (99.0.0) exists in extra prefix"
else
  err "5b: warning did NOT fire (expected ⚠ for 99.0.0 > $INSTALLED_VER)"
fi

# 5c. Direction 2 positive (DEF-13): older install at shadow prefix shadows PATH → ⚠
# Simulates: user types `docuflow` → resolves to 0.0.1 at FAKE_PREFIX_SHADOW,
# but the running binary is INSTALLED_VER (newer).  Warning must fire.
_fake_install "$FAKE_PREFIX_SHADOW" "0.0.1"
rm -f "$CACHE_FILE"
WARN_OUT=$(DOCUFLOW_PATH_OVERRIDE_BIN="$FAKE_PREFIX_SHADOW/bin/docuflow" \
  DOCUFLOW_EXTRA_PREFIXES="$FAKE_PREFIX_SHADOW" DOCUFLOW_CHECK_NOW=1 \
  "$DOCUFLOW_BIN" status 2>&1 >/dev/null) || true
if echo "$WARN_OUT" | grep -q "⚠"; then
  ok "5c: warning fires when older install (0.0.1) shadows active binary in PATH"
else
  err "5c: warning did NOT fire (expected ⚠ for PATH-shadow by 0.0.1 < $INSTALLED_VER)"
fi

# 5d. Direction 2 negative: PATH resolves to active binary itself → no warning
rm -f "$CACHE_FILE"
WARN_OUT=$(DOCUFLOW_PATH_OVERRIDE_BIN="$DOCUFLOW_BIN" \
  DOCUFLOW_CHECK_NOW=1 \
  "$DOCUFLOW_BIN" status 2>&1 >/dev/null) || true
if echo "$WARN_OUT" | grep -q "⚠"; then
  err "5d: spurious warning when PATH resolves to active binary (no shadowing)"
else
  ok "5d: no warning when PATH resolves to active binary"
fi

rm -rf "$FAKE_PREFIX_OLD" "$FAKE_PREFIX_NEW" "$FAKE_PREFIX_SHADOW"
rm -f "$CACHE_FILE"

# ── 6. Summary ────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Result: $pass passed  $fail failed  $skip skipped"
echo ""
if [[ $fail -gt 0 ]]; then
  echo "✗ Packed verification FAILED — do not publish"
  exit 1
else
  echo "✓ Packed verification PASSED — safe to publish"
  exit 0
fi
