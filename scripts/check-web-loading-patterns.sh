#!/usr/bin/env bash
# check-web-loading-patterns.sh
#
# Enforces the SPEC-228 web loading-states convention
# (apps/web/docs/loading-states.md): React islands must use the canonical
# loading toolkit (Spinner / SkeletonCard / LoadingButton) instead of ad-hoc
# loading indicators.
#
# Rules (scanned in apps/web/src/components/**/*.tsx):
# 1. No ⏳ emoji used as a loading indicator.
# 2. No '...' / "..." string literal used as a loading label.
#
# Legitimate exceptions (e.g. an ellipsis in truncation copy) can be suppressed
# by adding a trailing comment on the offending line:
#   // loading-guard: ignore
# Prefer the … character (U+2026) over a literal '...' where it is real copy.
#
# NOTE: this guard is wired into CI only once the Phase 2-4 migrations have
# removed all pre-existing violations (SPEC-228 T-022). Until then it can be run
# manually:  bash scripts/check-web-loading-patterns.sh

set -euo pipefail

SCAN_DIR="${1:-apps/web/src/components}"
FAIL=0
PASS_COUNT=0

echo "=== Checking web loading-state patterns in $SCAN_DIR ==="

if [ ! -d "$SCAN_DIR" ]; then
    echo "  Scan dir '$SCAN_DIR' not found — nothing to check."
    exit 0
fi

# ---------------------------------------------------------------------------
# Check 1: ⏳ emoji as a loading indicator
# ---------------------------------------------------------------------------
echo ""
echo "1. Scanning for ⏳ emoji..."

EMOJI_MATCHES=$(grep -rn --include="*.tsx" \
    '⏳' \
    "$SCAN_DIR" \
    2>/dev/null \
    | grep -v "loading-guard: ignore" \
    | grep -vE '^[^:]*:[0-9]+:[[:space:]]*(//|\*)' \
    || true)

if [ -n "$EMOJI_MATCHES" ]; then
    echo "ERROR: ⏳ emoji used as a loading indicator:"
    echo "$EMOJI_MATCHES"
    echo ""
    echo "  Use <Spinner /> from shared/feedback/ instead."
    FAIL=1
else
    echo "  OK — no ⏳ emoji found."
    PASS_COUNT=$((PASS_COUNT + 1))
fi

# ---------------------------------------------------------------------------
# Check 2: '...' / "..." string literal as a loading label
# ---------------------------------------------------------------------------
echo ""
echo "2. Scanning for '...' / \"...\" string literals..."

DOTS_MATCHES=$(grep -rn --include="*.tsx" \
    -E "'\.\.\.'|\"\.\.\.\"" \
    "$SCAN_DIR" \
    2>/dev/null \
    | grep -v "loading-guard: ignore" \
    | grep -vE '^[^:]*:[0-9]+:[[:space:]]*(//|\*)' \
    || true)

if [ -n "$DOTS_MATCHES" ]; then
    echo "ERROR: '...' string literal used as a loading label:"
    echo "$DOTS_MATCHES"
    echo ""
    echo "  Use <Spinner /> or an i18n-keyed label (e.g. t('...sending', 'Enviando…'))."
    echo "  If this is real copy, use the … character or add: // loading-guard: ignore"
    FAIL=1
else
    echo "  OK — no '...' loading-label literals found."
    PASS_COUNT=$((PASS_COUNT + 1))
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Results: $PASS_COUNT/2 checks passed ==="

if [ "$FAIL" -eq 1 ]; then
    echo "FAILED — Fix the issues above before merging (see apps/web/docs/loading-states.md)."
    exit 1
fi

echo "All checks passed."
exit 0
