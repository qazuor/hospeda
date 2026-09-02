#!/usr/bin/env bash
# check-hospeda-email-domain.sh
#
# HOS-928 — the real Hospeda domain is `hospeda.com.ar`. `hospeda.com` (no
# `.ar`) is a "null MX" domain (RFC 7505: MX 0 .) that explicitly refuses
# mail — anything sent to `info@hospeda.com` bounces with a permanent error.
# Every contact address published on the site MUST carry the `.ar` suffix.
#
# Scanned paths are the user-facing surfaces only:
#   - packages/i18n/src  (translated copy shown to end users)
#   - apps/*/src          (hardcoded strings in .astro/.tsx/.ts source)
#
# Tests, fixtures and internal docs are intentionally OUT of scope — they
# hold ~90 fictional `@hospeda.com` addresses that are not published anywhere
# and do not need the real domain.
#
# The predicate uses a negative lookahead (`(?!\.ar)`) so a CORRECT
# `@hospeda.com.ar` address (which contains the substring `@hospeda.com`) is
# never flagged — a plain substring match would make this guard permanently
# red. `grep -P` is used for that lookahead (standard GNU grep, NOT `rg`,
# which is ugrep in this repo and does not reliably support combined flags
# for this kind of scan — see CLAUDE.md "rg acá es ugrep").
#
# Wired into CI via the `check:hospeda-email-domain` package script and the
# Guards job in `.github/workflows/ci.yml` (being listed in `check:guards`
# alone does NOT run it in CI — see the note in that job).
#
# Usage: bash scripts/check-hospeda-email-domain.sh
set -euo pipefail

echo "=== HOS-928: hospeda.com.ar email domain guard ==="
echo "Checking that no published contact address uses the bounces-everything"
echo "'@hospeda.com' (no .ar) domain in packages/i18n/src or apps/*/src..."
echo

MATCHES=$(grep -rnP '@hospeda\.com(?!\.ar)' \
    packages/i18n/src apps/*/src \
    --include='*.json' \
    --include='*.astro' \
    --include='*.tsx' \
    --include='*.ts' \
    --exclude='*.test.*' \
    --exclude='*.spec.*' \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    2>/dev/null || true)

if [ -n "$MATCHES" ]; then
    echo "ERROR: found '@hospeda.com' (missing .ar) in published content:"
    echo "$MATCHES"
    echo
    echo "hospeda.com has a null MX record (RFC 7505) and refuses all mail."
    echo "Use the real domain: @hospeda.com.ar"
    exit 1
fi

echo "OK — no '@hospeda.com' (missing .ar) addresses in published content."
