#!/usr/bin/env bash
# check-bare-cloudinary-img.sh
#
# Detects bare <img> tags in apps/admin/src and apps/web/src whose src
# attribute embeds a Cloudinary URL directly (as a string literal or template
# literal). Every Cloudinary-hosted image in admin + web MUST go through
# `getMediaUrl()` from `@repo/media` so preset transforms, fallbacks, and the
# upload-delivery normalization apply uniformly.
#
# After T-041 (admin) and T-048 (web) migrated all raw <img src={cloudinaryUrl}>
# usages to getMediaUrl, this script backstops those migrations by rejecting
# regressions at PR time.
#
# Why not a Biome rule: Biome 1.9.x does not ship a `noRestrictedSyntax` rule
# (that is an ESLint rule). Biome only exposes `noRestrictedImports`, which
# cannot match JSX attribute contents. SPEC-078-GAPS T-043 documents this
# fallback: the CI script is the authoritative enforcement.
#
# Scope:
#   - Scans apps/admin/src/**.{ts,tsx,astro,jsx} and apps/web/src/**.{ts,tsx,astro,jsx}
#   - Excludes: **/test/**, **/*.test.*, **/*.spec.*, **/dist/**, **/node_modules/**, **/.turbo/**
#   - Pattern: multi-line <img ... src=...cloudinary... matching literals or template literals
#
# Exit codes:
#   0  no violations
#   1  one or more bare <img src> references a Cloudinary URL

set -euo pipefail

echo "=== Checking for bare <img> tags with Cloudinary URLs ==="
echo ""
echo "Scanning apps/admin/src and apps/web/src..."

# Multi-line regex: <img ... src= ... res.cloudinary.com (up to 400 chars
# between <img and the cloudinary literal to span formatted JSX attribute
# lists). Matches:
#   <img src="https://res.cloudinary.com/..." />
#   <img src={`https://res.cloudinary.com/...${x}`} />
#   <img alt="x"\n     src={`https://res.cloudinary.com/...`} />
PATTERN='<img[^>]{0,400}src=[^>]{0,400}res\.cloudinary\.com'

MATCHES=""

if command -v rg >/dev/null 2>&1; then
    # ripgrep path (preferred — used in CI runners with rg installed)
    #   -U --multiline-dotall  enable multi-line matching across formatted JSX
    #   -g '!**/test/**'       skip test directories
    #   -g '!**/*.test.*'      skip test files
    #   -g '!**/*.spec.*'      skip spec files
    #   -g '!**/dist/**'       skip build output
    #   -g '!**/node_modules/**' skip dependencies
    #   -g '!**/.turbo/**'     skip turbo cache
    MATCHES=$(rg \
        --no-messages \
        -U --multiline-dotall \
        -n \
        -g '!**/test/**' \
        -g '!**/*.test.*' \
        -g '!**/*.spec.*' \
        -g '!**/dist/**' \
        -g '!**/node_modules/**' \
        -g '!**/.turbo/**' \
        -g '*.{ts,tsx,astro,jsx,mjs,cjs}' \
        "$PATTERN" \
        apps/admin/src apps/web/src \
        || true)
else
    # grep fallback (local dev environments without ripgrep).
    # Note: GNU grep -P with \K would be cleaner, but PCRE is not portable.
    # We concatenate each file with tr so the multi-line regex can span lines,
    # then filter out excluded paths.
    MATCHES=""
    while IFS= read -r -d '' file; do
        if [ -f "$file" ]; then
            # Squash newlines, then look for the pattern; if found, report file.
            if tr '\n' ' ' < "$file" | grep -qE "$PATTERN"; then
                MATCHES="${MATCHES}${file}: bare <img> with Cloudinary URL detected"$'\n'
            fi
        fi
    done < <(find apps/admin/src apps/web/src \
        -type d \( -name node_modules -o -name dist -o -name .turbo -o -name test \) -prune -o \
        -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.astro' -o -name '*.jsx' -o -name '*.mjs' -o -name '*.cjs' \) \
        ! -name '*.test.*' ! -name '*.spec.*' -print0)
    MATCHES=$(printf '%s' "$MATCHES" | sed '/^$/d')
fi

if [ -n "$MATCHES" ]; then
    echo ""
    echo "ERROR: Bare <img> tags with Cloudinary URLs found:"
    echo ""
    echo "$MATCHES"
    echo ""
    echo "  Cloudinary URLs in admin + web MUST go through getMediaUrl() from @repo/media."
    echo ""
    echo "  Replace:"
    echo "    <img src={cloudinaryUrl} />"
    echo "    <img src=\"https://res.cloudinary.com/...\" />"
    echo ""
    echo "  With:"
    echo "    import { getMediaUrl } from '@repo/media';"
    echo "    <img src={getMediaUrl(cloudinaryUrl, { preset: 'card' })} />"
    echo ""
    exit 1
fi

echo "  OK — no bare <img> Cloudinary URLs found in admin or web source."
echo ""
echo "All checks passed."
exit 0
