#!/usr/bin/env bash
# check-qrcode-engine-isolation.sh — HOS-1129
#
# `qrcode` may be imported by exactly ONE file in this repo:
#
#     apps/api/src/utils/qr-render.ts
#
# WHY
#
# A printed QR cannot be corrected. So the platform never encodes a final
# destination — it encodes an identifier it owns (`{site}/qr/{slug}/`) and
# resolves that with a 302 to a row an operator can edit. That is also the only
# way a scan can be counted, because it is the only way a scan passes through
# us.
#
# Anything that reaches for `qrcode` directly is, by construction, drawing a
# string nobody vetted: it has bypassed `qr_codes` and therefore bypassed both
# guarantees. That is not hypothetical. While the centralized system was being
# built (HOS-980/981), TWO parallel generators appeared inside four days —
# `brochure-render.ts` and `certificate-render.ts` — each encoding the listing's
# final URL straight into a PDF. HOS-1129 removed them.
#
# WHAT IS CHECKED — AND WHAT IS NOT
#
# The IMPORT of the package `qrcode`, not the name of any function. A guard
# anchored on `QRCode.create` would die silently the day somebody uses
# `toDataURL` instead, and the PR that renamed it would not see the guard fail.
# The import is also the thing actually being forbidden, so it is the honest
# predicate.
#
# Say the limit out loud, because a guard that promises more than it does is
# tomorrow's escape hatch: the PREDICATE IS THIS ONE PACKAGE. A third generator
# that reaches for `qrcode-generator`, `qrcode.react`, `node-qrcode` or a hand
# -rolled encoder passes this script clean. That is a deliberate trade, not an
# oversight — a predicate wide enough to catch "anything that might draw a QR"
# would match on names rather than on imports and go vacuous the first time one
# was renamed. Adding a package to the list the day one appears is a two-line
# change; keep the list honest rather than aspirational.
#
# Covered forms: `from 'qrcode'`, `from "qrcode"`, from a backtick, plus
# `require(…)` / `import(…)` in any of those three quotings, and any subpath
# (`qrcode/lib/...`).
#
# Known, deliberately uncovered syntax: a pure side-effect `import 'qrcode';`
# (it binds nothing, so it cannot draw), `require ('qrcode')` with a space
# (Biome reformats it away), `createRequire(...)('qrcode')`, and dynamic string
# concatenation like `'qr' + 'code'` (undetectable by grep at all).
#
# There is NO comment-based escape hatch, deliberately: an `// ignore` line is
# how a fail-open gets added by whoever is in a hurry. The allowlist below is a
# single explicit path, and widening it is a code review.

set -euo pipefail

# The ONE file allowed to import the package.
ALLOWED_FILE="apps/api/src/utils/qr-render.ts"

# The package this guard is about.
PACKAGE="qrcode"

# Where to look.
#
# `scripts/` is included so a one-off script cannot mint codes either, and
# `infra/` because it holds real, tracked TypeScript and JavaScript
# (`infra/cloudflare/{posthog-proxy,sentry-tunnel}/`) that this guard used to
# be blind to. The repo ROOT is covered separately below — `-r` over these
# directories never visits a top-level file, which was the second blind spot.
SEARCH_DIRS="apps packages scripts infra"

# File extensions that can carry an import.
EXTENSIONS=(ts tsx mts cts js mjs cjs astro)

echo "=== Checking that '${PACKAGE}' has exactly one importer ==="
echo ""

# A guard that finds nothing because it is looking in the wrong place passes
# just as quietly as one that finds nothing because the code is clean, so every
# directory it claims to search must actually be there.
for dir in $SEARCH_DIRS; do
    if [ ! -d "$dir" ]; then
        echo "ERROR: search directory '${dir}' does not exist."
        echo ""
        echo "  Either it moved — update SEARCH_DIRS in this script — or this"
        echo "  guard has been passing while looking at nothing."
        exit 1
    fi
done

# Matches:
#   from 'qrcode'  /  from "qrcode"  /  from `qrcode`  /  from 'qrcode/lib/x'
#   require('qrcode')  /  import('qrcode')  /  import(`qrcode`)
# The character class after the package name is what pins the match to the
# package boundary: a quote (exact) or a slash (subpath). Without it,
# `qrcode-generator` and `qrcode.react` would both slip through — which is a
# statement about the match, not about the predicate: those two packages are
# out of scope either way, see the header.
PATTERN="(from|require\(|import\()[[:space:]]*['\"\`]${PACKAGE}(['\"\`]|/)"

INCLUDES=()
for ext in "${EXTENSIONS[@]}"; do
    INCLUDES+=("--include=*.${ext}")
done

MATCHES=$(grep -rnE "${INCLUDES[@]}" \
    "$PATTERN" \
    $SEARCH_DIRS \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=.turbo \
    2>/dev/null \
    | grep -v "^${ALLOWED_FILE}:" \
    || true)

# The repo root, which no recursive search over SEARCH_DIRS reaches. Collected
# as an explicit file list rather than by recursing `.`, which would walk every
# `node_modules` in the workspace. `-maxdepth 1 -type f` keeps it to the top
# level; the list is already extension-filtered, so no `--include` is needed.
ROOT_FIND=(find . -maxdepth 1 -type f '(')
for index in "${!EXTENSIONS[@]}"; do
    [ "$index" -gt 0 ] && ROOT_FIND+=(-o)
    ROOT_FIND+=(-name "*.${EXTENSIONS[$index]}")
done
ROOT_FIND+=(')')

ROOT_FILES=()
while IFS= read -r file; do
    ROOT_FILES+=("$file")
done < <("${ROOT_FIND[@]}" 2>/dev/null | sort)

# Never hand grep an empty file list: with no path argument it reads STDIN and
# hangs forever with no output and no error.
if [ ${#ROOT_FILES[@]} -gt 0 ]; then
    ROOT_MATCHES=$(grep -nE "$PATTERN" "${ROOT_FILES[@]}" 2>/dev/null || true)
    if [ -n "$ROOT_MATCHES" ]; then
        MATCHES="${MATCHES}${MATCHES:+$'\n'}${ROOT_MATCHES}"
    fi
fi

echo "  Searched: ${SEARCH_DIRS} and ${#ROOT_FILES[@]} file(s) at the repo root."
echo ""

if [ -n "$MATCHES" ]; then
    echo "ERROR: '${PACKAGE}' imported outside the QR render engine:"
    echo ""
    echo "$MATCHES"
    echo ""
    echo "  Only ${ALLOWED_FILE} may import '${PACKAGE}'."
    echo ""
    echo "  A code drawn straight from this package encodes a final URL, which"
    echo "  means: it can never be repointed once printed, and its scans are"
    echo "  never counted. Ask QrCodeService.getOrCreateForEntity() for a slug"
    echo "  and encode {site}/qr/{slug}/ instead."
    echo ""
    echo "  Need the raw module grid for a vector drawing (PDF)? Use"
    echo "  renderQrMatrix() from ${ALLOWED_FILE} — that is why it is exported."
    exit 1
fi

# Same reasoning as the directory check above, for the pattern itself: assert
# the allowed importer is actually there and actually matched.
if ! grep -qE "$PATTERN" "$ALLOWED_FILE" 2>/dev/null; then
    echo "ERROR: the engine ${ALLOWED_FILE} does not import '${PACKAGE}'."
    echo ""
    echo "  Either the engine moved — update ALLOWED_FILE in this script — or"
    echo "  this guard's pattern no longer matches anything and has been"
    echo "  passing vacuously."
    exit 1
fi

echo "  OK — '${PACKAGE}' is imported only by ${ALLOWED_FILE}."
echo ""
echo "All checks passed."
exit 0
