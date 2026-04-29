#!/usr/bin/env bash
# check-inline-nonce.sh
#
# SPEC-047 — guard that every `is:inline` <script> or <style> in
# `apps/web/src/**/*.astro` carries a `nonce={cspNonce}` attribute.
#
# The web app's CSP uses nonce-based integrity (no `'unsafe-inline'` in
# `script-src` or `style-src`). An `is:inline` block without a nonce
# bypasses Astro's bundle/hash pipeline, so it has no integrity at all
# — Phase 2 enforcement would silently block it.
#
# To resolve a CI failure: add `nonce={cspNonce}` to the offending tag,
# making sure the layout/page reads `cspNonce` from `Astro.locals`. If
# the inline block is genuinely unsafe to nonce-attach (rare), refactor
# the script/style to a non-inline asset that Astro can hash.

set -eu

WEB_DIR="apps/web/src"
FAIL=0

if [[ ! -d "$WEB_DIR" ]]; then
    echo "Skipped — $WEB_DIR not found."
    exit 0
fi

while IFS= read -r match; do
    # Each match is "file:lineno:content". The content has been
    # pre-filtered to lines containing `is:inline` already.
    file=$(echo "$match" | cut -d: -f1)
    lineno=$(echo "$match" | cut -d: -f2)
    line=$(echo "$match" | cut -d: -f3-)

    # Skip if the line itself contains `nonce={cspNonce}` or
    # `nonce={Astro.locals.cspNonce}` (single-line tag).
    if echo "$line" | grep -qE 'nonce=\{[^}]*cspNonce[^}]*\}'; then
        continue
    fi

    # Multi-line tags: look ahead a few lines for the nonce attribute
    # before the next `>`. Read up to 5 lines of context.
    end=$((lineno + 5))
    context=$(sed -n "${lineno},${end}p" "$file")
    # The tag ends at the first `>` we encounter. Truncate context to that.
    tag_only=$(echo "$context" | awk 'BEGIN{rec=""} {rec=rec $0; if (index($0, ">")) {sub(/>.*$/, ">", rec); print rec; exit}}')
    if echo "$tag_only" | grep -qE 'nonce=\{[^}]*cspNonce[^}]*\}'; then
        continue
    fi

    echo "FAIL $file:$lineno: is:inline tag without nonce={cspNonce}"
    echo "    $line"
    FAIL=1
done < <(grep -rn "is:inline" "$WEB_DIR" --include="*.astro" 2>/dev/null)

if [[ $FAIL -eq 1 ]]; then
    echo ""
    echo "FAIL: one or more is:inline blocks lack a nonce attribute."
    echo "Add nonce={cspNonce} so the block participates in CSP integrity."
    exit 1
fi

echo "OK — all is:inline blocks carry nonce={cspNonce}."
exit 0
