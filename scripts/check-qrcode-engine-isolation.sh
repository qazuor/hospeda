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
# final URL straight into a PDF. HOS-1129 removed them. This guard is what stops
# a third.
#
# WHAT IS CHECKED
#
# The IMPORT of the package, not the name of any function. A guard anchored on
# `QRCode.create` would die silently the day somebody uses `toDataURL` instead,
# and the PR that renamed it would not see the guard fail. The import is also
# the thing actually being forbidden, so it is the honest predicate.
#
# Covered forms: `from 'qrcode'`, `from "qrcode"`, `require('qrcode')`,
# `import('qrcode')`, and any subpath (`qrcode/lib/...`).
#
# There is NO comment-based escape hatch, deliberately: an `// ignore` line is
# how a fail-open gets added by whoever is in a hurry. The allowlist below is a
# single explicit path, and widening it is a code review.

set -euo pipefail

# The ONE file allowed to import the package.
ALLOWED_FILE="apps/api/src/utils/qr-render.ts"

# The package this guard is about.
PACKAGE="qrcode"

# Where to look. `scripts/` is included so a one-off script cannot mint codes
# either; this guard file itself is excluded by name below.
SEARCH_DIRS="apps packages scripts"

echo "=== Checking that '${PACKAGE}' has exactly one importer ==="
echo ""

# Matches:
#   from 'qrcode'  /  from "qrcode"  /  from 'qrcode/lib/x'
#   require('qrcode')  /  import('qrcode')
# The character class after the package name is what pins the match to the
# package boundary: a quote (exact) or a slash (subpath). Without it,
# `qrcode-generator` and `qrcode.react` would both slip through.
PATTERN="(from|require\(|import\()[[:space:]]*['\"]${PACKAGE}(['\"]|/)"

MATCHES=$(grep -rnE --include="*.ts" --include="*.tsx" --include="*.mts" --include="*.cts" \
    --include="*.js" --include="*.mjs" --include="*.cjs" --include="*.astro" \
    "$PATTERN" \
    $SEARCH_DIRS \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=.turbo \
    2>/dev/null \
    | grep -v "^${ALLOWED_FILE}:" \
    || true)

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

# A guard that finds nothing because it is looking in the wrong place passes
# just as quietly as one that finds nothing because the code is clean. Assert
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
