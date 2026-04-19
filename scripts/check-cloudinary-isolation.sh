#!/usr/bin/env bash
# check-cloudinary-isolation.sh
#
# Enforces Cloudinary SDK isolation: only `packages/media/**` is allowed to
# import the `cloudinary` SDK directly. Every other consumer MUST go through
# the abstractions exposed by `@repo/media` (default entry, `/server`, or
# `/test-utils`).
#
# Why: the Cloudinary SDK is server-only. Letting it leak into client bundles
# (admin / web) explodes bundle size and breaks the boundary established in
# SPEC-078-GAPS T-017. This guard backs up the Biome `noRestrictedImports`
# rules in admin + web with a repo-wide CI check that no other surface can
# regress.
#
# Exit codes:
#   0  no violations
#   1  one or more files import `cloudinary` outside `packages/media/`
#   2  required tooling missing

set -euo pipefail

echo "=== Checking Cloudinary SDK isolation ==="
echo ""
echo "Scanning apps/ and packages/ for direct 'cloudinary' imports outside packages/media/..."

PATTERN="from ['\"]cloudinary['\"]"
MATCHES=""

if command -v rg >/dev/null 2>&1; then
    # ripgrep path (preferred — used in CI runners with rg installed)
    #   -g '!packages/media/**'  excludes the only package allowed to import cloudinary
    #   -g '!**/dist/**'         skip build output
    #   -g '!**/node_modules/**' skip dependencies (rg ignores by default, but be explicit)
    #   --no-messages            suppress "no matches" stderr noise
    MATCHES=$(rg \
        --no-messages \
        -g '!packages/media/**' \
        -g '!**/dist/**' \
        -g '!**/node_modules/**' \
        "$PATTERN" \
        apps/ packages/ \
        || true)
else
    # grep fallback (local dev environments without ripgrep)
    MATCHES=$(grep -rnE \
        --include='*.ts' \
        --include='*.tsx' \
        --include='*.js' \
        --include='*.mjs' \
        --include='*.cjs' \
        --exclude-dir=node_modules \
        --exclude-dir=dist \
        "$PATTERN" \
        apps/ packages/ \
        2>/dev/null \
        | grep -v '^packages/media/' \
        || true)
fi

if [ -n "$MATCHES" ]; then
    echo ""
    echo "ERROR: Direct 'cloudinary' SDK imports found outside packages/media/:"
    echo ""
    echo "$MATCHES"
    echo ""
    echo "  Only @repo/media is allowed to import the Cloudinary SDK directly."
    echo "  Consume Cloudinary functionality via:"
    echo "    - import { ... } from '@repo/media'            (shared types/utils)"
    echo "    - import { ... } from '@repo/media/server'     (server-only provider)"
    echo "    - import { ... } from '@repo/media/test-utils' (test helpers)"
    echo ""
    exit 1
fi

echo "  OK — no direct Cloudinary imports outside packages/media/."
echo ""
echo "All checks passed."
exit 0
