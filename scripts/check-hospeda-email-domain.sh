#!/usr/bin/env bash
# check-hospeda-email-domain.sh
#
# HOS-928 — the real Hospeda domain is `hospeda.com.ar`. The bug this guards
# against is wider than one wrong domain: it is ANY published `@hospeda.<x>`
# where `<x>` isn't `com.ar`.
#
#   - `@hospeda.com` (no `.ar`) is a "null MX" domain (RFC 7505: MX 0 .) that
#     explicitly refuses mail — anything sent to `info@hospeda.com` bounces
#     with a permanent error.
#   - `@hospeda.tur.ar` — found live in `en`/`pt` `footer.json` when this
#     guard was first written, i.e. in every page's footer on the English and
#     Portuguese sites — is worse: DNS-measured 2026-09-02, `hospeda.tur.ar`
#     has no NS, no A and no MX record at all. It isn't a second real Hospeda
#     domain, it's a domain nobody registered. Mail to it dies on NXDOMAIN
#     before it even reaches a mail server.
#
# The first version of this guard only matched the first bullet
# (`@hospeda\.com(?!\.ar)`), which is why it missed the second: it found
# exactly the one shape of the bug it went looking for. The predicate below
# is the general case — "any `@hospeda.<something>` that isn't exactly
# `@hospeda.com.ar`" — so a THIRD invented domain (`@hospeda.net`,
# `@hospeda.com.br`, ...) is caught the same way, without needing its own
# clause.
#
# Scanned paths are the user-facing surfaces only:
#   - packages/i18n/src  (translated copy shown to end users)
#   - apps/*/src          (hardcoded strings in .astro/.tsx/.ts source)
#
# Tests, fixtures and internal docs are intentionally OUT of scope — they
# hold fictional `@hospeda.*` addresses that are not published anywhere and
# do not need the real domain.
#
# The predicate uses a negative lookahead (`(?!com\.ar\b)`) so a CORRECT
# `@hospeda.com.ar` address is never flagged, INCLUDING when it sits at the
# end of a sentence (`info@hospeda.com.ar.` — 7 such cases exist in the
# locale copy today): `\b` (word boundary), not `$`, is what lets the
# trailing sentence period follow `ar` without breaking the match. A plain
# substring match on `@hospeda.com` would make this guard permanently red,
# since a correct `@hospeda.com.ar` address CONTAINS that substring.
# `grep -P` is used for that lookahead (standard GNU grep, NOT `rg`, which is
# ugrep in this repo and does not reliably support combined flags for this
# kind of scan — see CLAUDE.md "rg acá es ugrep").
#
# Wired into CI via the `check:hospeda-email-domain` package script and the
# Guards job in `.github/workflows/ci.yml` (being listed in `check:guards`
# alone does NOT run it in CI — see the note in that job).
#
# Usage: bash scripts/check-hospeda-email-domain.sh
set -euo pipefail

echo "=== HOS-928: hospeda.com.ar email domain guard ==="
echo "Checking that every published '@hospeda.*' address in"
echo "packages/i18n/src or apps/*/src is exactly '@hospeda.com.ar'..."
echo

MATCHES=$(grep -rnP '@hospeda\.(?!com\.ar\b)' \
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
    echo "ERROR: found a published '@hospeda.*' address that is not @hospeda.com.ar:"
    echo "$MATCHES"
    echo
    echo "@hospeda.com has a null MX record (RFC 7505) and refuses all mail."
    echo "Any other @hospeda.<x> domain is unverified and may not even resolve"
    echo "(@hospeda.tur.ar had no NS/A/MX record at all — NXDOMAIN)."
    echo "Use the real domain: @hospeda.com.ar"
    exit 1
fi

echo "OK — every published '@hospeda.*' address is @hospeda.com.ar."
