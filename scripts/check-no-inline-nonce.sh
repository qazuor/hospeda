#!/usr/bin/env bash
# check-no-inline-nonce.sh
#
# HOS-369 WB0-1 — guard that NO `.astro` source in `apps/web/src/**` carries a
# CSP `nonce` attribute or references `cspNonce`.
#
# This is the inverse of the SPEC-047 guard it replaces
# (`check-inline-nonce.sh`, which REQUIRED `nonce={cspNonce}` on every
# `is:inline` block). The web app's CSP no longer uses a per-request nonce:
# `middleware.ts` computes the sha256 of each inline `<script>`/`<style>` and
# emits those as `script-src`/`style-src` sources.
#
# Why the reversal matters: Cloudflare caches response headers together with
# the body, so a per-request nonce survives into the edge cache and becomes a
# static, publicly readable token for the whole TTL — anyone can GET the page,
# read it and reuse it, which collapses the inline-script protection HOS-30
# phase 2 was built to provide. A content hash is derived from the body it
# describes, so the two can never desynchronize, cached or not. See
# `.specs/HOS-369-web-performance-edge-cache/spec.md` §5.13 and decision D-9.
#
# To resolve a CI failure: DELETE the `nonce` attribute. The inline block needs
# no CSP attribute at all — the middleware walker hashes whatever it emits. If
# the block is genuinely un-hashable (it is not; the walker hashes every inline
# script and style it finds), reopen the D-9 decision rather than reinstating a
# nonce.
#
# What this guard does NOT cover:
# - Runtime-injected inline scripts/styles (created by JS after the response
#   was sent). The walker never sees those; they need an explicit hash source
#   in `buildCspHeader` (as the Astro island `<style>` already has).
# - `.ts`/`.tsx` sources. React islands do not emit inline `<script>` tags in
#   SSR HTML today; if one ever does, extend EXTENSIONS below.
# - Whether the emitted hashes actually match the body. That is covered by the
#   unit tests in `apps/web/integrations/csp-hash-collector/test/` and the
#   end-to-end test in `apps/web/test/integration/csp-hash-emission.test.ts`.

set -eu

WEB_DIR="apps/web/src"

if [[ ! -d "$WEB_DIR" ]]; then
    echo "Skipped — $WEB_DIR not found."
    exit 0
fi

# The two forbidden shapes: a `nonce=` attribute (in any tag), and any
# reference to the removed `cspNonce` locals field.
FORBIDDEN_PATTERN='nonce=|cspNonce'

scan() {
    # $1 = directory to scan. Prints "file:lineno:content" for every hit.
    grep -rnE "$FORBIDDEN_PATTERN" "$1" --include="*.astro" 2>/dev/null || true
}

# --- Non-vacuity check 1: the scan must actually reach a corpus of files. ---
FILE_COUNT=$(find "$WEB_DIR" -name "*.astro" -type f | wc -l)
if [[ "$FILE_COUNT" -lt 50 ]]; then
    echo "FAIL: only $FILE_COUNT .astro files found under $WEB_DIR — the guard is"
    echo "      not scanning the app. Check WEB_DIR / the --include filter."
    exit 1
fi

# --- Non-vacuity check 2: the detector must flag a known-bad fixture. ---
# Without this, a typo in FORBIDDEN_PATTERN would make the guard pass on an
# app that is full of nonces.
FIXTURE_DIR=$(mktemp -d)
trap 'rm -rf "$FIXTURE_DIR"' EXIT
cat >"$FIXTURE_DIR/known-bad.astro" <<'FIXTURE'
---
const cspNonce = Astro.locals.cspNonce ?? '';
---
<script is:inline nonce={cspNonce}>console.log(1)</script>
FIXTURE
if [[ -z "$(scan "$FIXTURE_DIR")" ]]; then
    echo "FAIL: the detector did not flag its own known-bad fixture."
    echo "      FORBIDDEN_PATTERN is broken — this guard would pass on anything."
    exit 1
fi

# --- The actual check. ---
HITS=$(scan "$WEB_DIR")
if [[ -n "$HITS" ]]; then
    echo "FAIL: CSP nonce attributes / cspNonce references found in .astro sources."
    echo ""
    echo "$HITS"
    echo ""
    echo "The web CSP is hash-based since HOS-369 WB0-1. Delete the nonce —"
    echo "middleware.ts hashes inline blocks by content. See spec §5.13 / D-9."
    exit 1
fi

echo "OK — no nonce attributes in $FILE_COUNT .astro files under $WEB_DIR."
exit 0
