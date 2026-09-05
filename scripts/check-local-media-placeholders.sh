#!/usr/bin/env bash
# check-local-media-placeholders.sh
#
# Static guard for the HOS-1144 CI cost guard: a CI run must issue ZERO
# requests to res.cloudinary.com.
#
# Background: `a11y-sweep.yml` and `e2e-pr.yml` seed the CI database with the
# REAL production Cloudinary URLs, and `apps/web` is `output: 'server'` with no
# prerendered pages. Every page render therefore made the SSR Node process
# download untransformed originals through Astro's `/_image` endpoint —
# 70.66 GB of Cloudinary bandwidth in 30 days, 98.5% of it from User-Agent
# `node` with no referrer, originating on GitHub runners.
#
# The fix intercepts at URL RESOLUTION (never in Astro's image service, which
# already holds the downloaded buffer by the time it runs), at four points,
# plus a browser-level DNS block as a second layer. This script fails CI when
# any of those pieces is removed, renamed, or when a NEW path appears that
# could hand a remote URL to Astro's `getImage()` without the established
# opt-out.
#
# Why a script and not a Biome rule: Biome 1.9.x ships no `noRestrictedSyntax`,
# and none of these invariants are import-shaped — same rationale as
# `check-bare-cloudinary-img.sh` (SPEC-078-GAPS T-043), whose structure this
# file follows.
#
# Usage:
#   pnpm check:local-media-placeholders
#
# Exit codes:
#   0  every invariant holds
#   1  one or more invariants broken; output names which

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The ONE spelling of the switch. Everything below is checked against it, so a
# rename here is a rename everywhere or the guard fails loudly.
ENV_VAR='HOSPEDA_USE_LOCAL_MEDIA_PLACEHOLDERS'
MODE_FN='isLocalMediaPlaceholderMode'
CANONICAL_MODULE='packages/media/src/local-media-placeholders.ts'

FAILURES=()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Emits a file with full-line comments removed (`//`, `*`, `/*`).
#
# Every "does this file call X" check below runs through this. Without it a
# JSDoc block that merely NAMES `isLocalMediaPlaceholderMode()` — which several
# of these files legitimately do, at length — satisfies the check while the real
# call sites are gone.
strip_comments() {
    grep -vE '^[[:space:]]*(\*|//|/\*)' "$1" || true
}

# Prints the body of `export function <name>` from a file: from the declaration
# line to the first line that is a bare `}` at column zero.
#
# Needed because a file can host SEVERAL independent routes to a remote fetch —
# `apps/web/src/lib/media.ts` holds both `toRenderableImageUrl` and
# `buildImageEndpointUrl` — and a check that only asks "does this FILE mention
# the mode" is satisfied by either one alone. Deleting the other reopens half
# the hole with the guard still green. Verified by mutation.
# The terminator must be a line that is EXACTLY `}` — not merely one STARTING
# with `}`. A destructured multi-line signature closes its parameter object at
# column zero (`}: BuildImageEndpointUrlOptions): string {`), so the looser form
# ended the body before it began and reported a live guard as missing.
function_body() {
    awk -v a="export function $2" -v b="function $2" '
        index($0, a) == 1 || index($0, b) == 1 { inside = 1 }
        inside { print }
        inside && /^\}[[:space:]]*$/ { exit }
    ' "$1"
}

echo "=== HOS-1144 — checking the CI Cloudinary cost guard ==="
echo ""

# ---------------------------------------------------------------------------
# 1. The canonical module still defines the switch under its canonical name.
# ---------------------------------------------------------------------------
echo "→ Canonical module..."
if [ ! -f "$CANONICAL_MODULE" ]; then
    FAILURES+=("$CANONICAL_MODULE is missing — the whole guard lives there.")
elif ! grep -qF "$ENV_VAR" "$CANONICAL_MODULE"; then
    FAILURES+=("$CANONICAL_MODULE no longer names $ENV_VAR.")
elif ! grep -qF "export function $MODE_FN" "$CANONICAL_MODULE"; then
    FAILURES+=("$CANONICAL_MODULE no longer exports $MODE_FN().")
fi

# The switch must NEVER be derived from CI: production build pipelines set
# CI=true, and serving grey placeholders to real visitors would be catastrophic.
# Comment lines are stripped first — the module's own docblock explains at
# length why CI is the wrong signal, and that prose must not trip the check.
if [ -f "$CANONICAL_MODULE" ] && \
   grep -vE '^[[:space:]]*(\*|//|/\*)' "$CANONICAL_MODULE" \
   | grep -qE 'process\.env\.CI([^A-Za-z0-9_]|$)|process\.env\[.CI.\]'; then
    FAILURES+=("$CANONICAL_MODULE reads process.env.CI. The mode MUST be keyed on $ENV_VAR alone — a production build that runs under CI=true would serve placeholders to visitors.")
fi

# ---------------------------------------------------------------------------
# 2. The four interception points still consult the mode.
#
# Each of these is a DISTINCT route a remote URL can take to the page. Losing
# any one silently reopens the bandwidth hole for that route only, which is
# exactly the kind of partial regression a single end-to-end check would miss.
# ---------------------------------------------------------------------------
echo "→ Interception points..."
declare -a SITES=(
    "packages/media/src/get-media-url.ts|the shared URL builder (every <Image>/getImage src)"
    "apps/web/src/lib/media.ts|toRenderableImageUrl + buildImageEndpointUrl (the raw-URL and /_image paths)"
    "apps/web/src/pages/api/og.ts|the OG endpoint (satori fetches the photo server-side)"
    "packages/seed/src/utils/cloudinary-upload.ts|the seed upload pipeline — the LARGEST source: it downloads the FULL ORIGINAL of every fixture image just to upload it back, and the on-disk cache that would absorb the repeat is gitignored, so a clean CI checkout misses on 100% of them every run"
)
for entry in "${SITES[@]}"; do
    file="${entry%%|*}"
    what="${entry#*|}"
    if [ ! -f "$file" ]; then
        FAILURES+=("$file is missing — it covered $what.")
    elif ! strip_comments "$file" | grep -qF "$MODE_FN("; then
        # Two things make this check bite. The trailing `(` — an
        # `import { isLocalMediaPlaceholderMode }` line satisfies a bare name
        # match while every call below it has been ripped out. And
        # `strip_comments` — these files carry long docblocks that name the
        # helper, and a prose mention is not a call. Both verified by mutation.
        FAILURES+=("$file imports or mentions $MODE_FN but never CALLS it in executable code. It covers $what; without a live call that route reaches Cloudinary on every CI run.")
    fi
done

# ---------------------------------------------------------------------------
# 2b. Per-ROUTE, not per-file.
#
# `apps/web/src/lib/media.ts` hosts two independent routes to a remote fetch.
# The file-level check above is satisfied by either one, so each function is
# asserted separately against its own body.
# ---------------------------------------------------------------------------
echo "→ Per-route coverage inside shared modules..."
WEB_MEDIA='apps/web/src/lib/media.ts'
declare -a ROUTES=(
    "$WEB_MEDIA|toRenderableImageUrl|the raw-URL path: five surfaces hand this value straight to an <img>/<Image> without ever calling getMediaUrl"
    "$WEB_MEDIA|buildImageEndpointUrl|the /_image path: Astro's endpoint downloads the untransformed original server-side before it optimises anything"
)
for entry in "${ROUTES[@]}"; do
    IFS='|' read -r file fn what <<< "$entry"
    if [ ! -f "$file" ]; then
        FAILURES+=("$file is missing — it covered $fn().")
        continue
    fi
    body=$(function_body "$file" "$fn")
    if [ -z "$body" ]; then
        FAILURES+=("$file no longer exports a function named $fn(). If it was renamed, update this guard's ROUTES list — it is anchored on the name because the name IS the route's identity.")
    elif ! grep -vE '^[[:space:]]*(\*|//|/\*)' <<< "$body" | grep -qF "$MODE_FN(" ; then
        FAILURES+=("$fn() in $file does not call $MODE_FN(). It covers $what.")
    fi
done

# ---------------------------------------------------------------------------
# 3. The browser-level second layer is still armed.
#
# A client island has no process.env, so a URL resolved in the browser escapes
# every check above. Chromium must be unable to resolve the host at all.
# ---------------------------------------------------------------------------
echo "→ Browser-level DNS block..."
declare -a BROWSER_FILES=(
    "apps/e2e/playwright.config.ts"
    "apps/web/scripts/a11y-sweep/sweep.ts"
)
for file in "${BROWSER_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        FAILURES+=("$file is missing — it armed the Chromium DNS block.")
        continue
    fi
    if ! grep -qF 'host-resolver-rules' "$file"; then
        FAILURES+=("$file no longer passes --host-resolver-rules. That flag is the only defence left when a client island resolves a Cloudinary URL in the browser.")
    fi
    if ! grep -qF 'res.cloudinary.com' "$file"; then
        FAILURES+=("$file no longer names res.cloudinary.com in its resolver rules.")
    fi
    # The block must be CONDITIONAL, and the check has to see the conditional
    # itself. A bare `import { isLocalMediaPlaceholderMode }` left behind after
    # someone deletes the ternary satisfies a mere name match, while the flag is
    # then armed unconditionally and local dev runs go blind — the guard would
    # say nothing. So: look at the window around the resolver-rules line and
    # require both a conditional and its empty else-branch there.
    rules_line=$(grep -n 'host-resolver-rules' "$file" | head -1 | cut -d: -f1 || true)
    if [ -n "$rules_line" ]; then
        window_start=$(( rules_line > 8 ? rules_line - 8 : 1 ))
        window=$(sed -n "${window_start},$((rules_line + 3))p" "$file")
        gated_by_name=false
        if grep -qE "${ENV_VAR}|${MODE_FN}|useLocalMediaPlaceholders" <<< "$window"; then
            gated_by_name=true
        fi
        # `? [` … `: []` is the shape both call sites use. Losing the `: []`
        # is exactly what "armed unconditionally" looks like in a diff.
        has_conditional=false
        if grep -q '?' <<< "$window" && grep -qF ': []' <<< "$window"; then
            has_conditional=true
        fi
        if [ "$gated_by_name" = false ] || [ "$has_conditional" = false ]; then
            FAILURES+=("$file arms --host-resolver-rules without a visible conditional gated on $ENV_VAR near line $rules_line. Unconditional, it blinds local dev runs to real images and the guard would never say so.")
        fi
    fi
done

# ---------------------------------------------------------------------------
# 4. Every CI workflow that boots apps/web sets the switch.
# ---------------------------------------------------------------------------
echo "→ Workflows..."
declare -a WORKFLOWS=(
    ".github/workflows/a11y-sweep.yml"
    ".github/workflows/e2e-pr.yml"
    ".github/workflows/e2e-nightly.yml"
    ".github/workflows/lighthouse.yml"
)
for file in "${WORKFLOWS[@]}"; do
    if [ ! -f "$file" ]; then
        FAILURES+=("$file is missing — it must declare $ENV_VAR.")
    elif ! grep -qE "^[[:space:]]*${ENV_VAR}:[[:space:]]*'?(true|1)'?[[:space:]]*$" "$file"; then
        FAILURES+=("$file does not set ${ENV_VAR}: 'true'. Every workflow that builds or boots apps/web must, or that workflow alone keeps billing Cloudinary.")
    fi
done

# ---------------------------------------------------------------------------
# 4b. The seed cut is ORDERED ahead of the download, and 'skipped' is counted.
#
# Presence of the call is not enough here: this file's whole cost is a single
# `fetch(originalUrl)` that pulls a full-size original. A cut that sits BELOW
# that line satisfies every check above and saves nothing, so the ordering is
# asserted by line number.
# ---------------------------------------------------------------------------
echo "→ Seed upload cut ordering..."
SEED_UPLOAD='packages/seed/src/utils/cloudinary-upload.ts'
SEED_PROCESSOR='packages/seed/src/utils/cloudinary-image-processor.ts'

if [ -f "$SEED_UPLOAD" ]; then
    # `|| true` on both: under `set -euo pipefail` a non-matching grep exits 1
    # and kills the script mid-section, so the ONE case this check exists to
    # report — the call being gone entirely — would abort silently with a bare
    # exit 1 and no message. Verified by mutation.
    #
    # Comments are stripped and the line numbers taken from the STRIPPED text,
    # so the two are comparable: the docblocks here discuss both `fetch` and the
    # mode at length, and a prose mention must not set either anchor.
    stripped=$(strip_comments "$SEED_UPLOAD")
    CUT_LINE=$(printf '%s\n' "$stripped" | grep -n "$MODE_FN(" | head -1 | cut -d: -f1 || true)
    # Anchored on a bare `fetch(`, NOT on `fetch(originalUrl)`. The literal form
    # was the whole correctness argument for this fix and it died on a rename:
    # refactoring the parameter to `sourceUrl` left FETCH_LINE empty, the
    # comparison was skipped, and the check passed green having evaluated
    # nothing. An argument-agnostic anchor cannot be renamed out of existence.
    FETCH_LINE=$(printf '%s\n' "$stripped" | grep -nE '\bfetch\(' | head -1 | cut -d: -f1 || true)
    if [ -z "$CUT_LINE" ]; then
        FAILURES+=("$SEED_UPLOAD never calls $MODE_FN() in executable code — the seed downloads every fixture original on every CI run.")
    elif [ -z "$FETCH_LINE" ]; then
        FAILURES+=("$SEED_UPLOAD contains no fetch( call, so the cut's ordering could not be verified. If the download moved elsewhere, move this check with it — do not delete it.")
    elif [ "$CUT_LINE" -gt "$FETCH_LINE" ]; then
        FAILURES+=("$SEED_UPLOAD calls $MODE_FN() after the first fetch( (stripped lines $CUT_LINE vs $FETCH_LINE). The cut must precede the download or it saves nothing.")
    fi
fi

# A bare `else counters.failures += 1` would silently report every skipped image
# as a tolerated failure, flipping the end-of-run tally to `warn` on every CI
# run — a lying log, and the exact fail-open-by-exclusion this status replaced.
if [ -f "$SEED_PROCESSOR" ] && ! grep -qF "outcome.status === 'skipped'" "$SEED_PROCESSOR"; then
    FAILURES+=("$SEED_PROCESSOR does not count the 'skipped' status explicitly. Without its own branch it falls into the failure counter and every CI run reports image failures that did not happen.")
fi

# ---------------------------------------------------------------------------
# 5. No NEW unguarded server-side image fetch in apps/web.
#
# BOTH `getImage()` and `<Image>` from `astro:assets` fetch whatever remote src
# they are given, SERVER-SIDE, from the Node process. The browser-level DNS
# block is blind to those requests because no browser makes them — which is
# exactly how two of these survived the first pass.
#
# Checking only `getImage(` used to let this section print "no unguarded
# getImage() call site exists": literally true, and misleading, while
# `<Image src={rawApiValue}>` sat one line away in the same file.
#
# A call site is accepted on one of five kinds of evidence, in order.
# ---------------------------------------------------------------------------
echo "→ Server-side image fetch sites in apps/web/src..."

# Files whose safety comes from the PRODUCER, in another file, and which
# therefore carry no local evidence a grep can see. Each entry was established
# by reading the producer, and names it. A new `<Image>` file is NOT allowed in
# here without doing the same: the entry is a record of an audit, not a way to
# silence one.
declare -a TRACED_SAFE=(
    # Producer verified: `toXCardProps` in apps/web/src/lib/api/transforms.ts
    # calls `processEntityImages({ ..., extract: true })`, which applies
    # `extractFeaturedImage()` / `extractGalleryUrls()` — both of which go
    # through `getMediaUrl()`. All eight producers were read and every one
    # passes `extract: true`; the `!extract` early-return path returns the raw
    # item and is used by none of them.
    "apps/web/src/components/shared/cards/AccommodationCard.astro"        # toAccommodationCardProps
    "apps/web/src/components/shared/cards/DestinationCard.astro"          # toDestinationCardProps
    "apps/web/src/components/shared/cards/EventCardFeatured.astro"        # toEventCardProps
    "apps/web/src/components/shared/cards/EventCardHorizontal.astro"      # toEventCardProps
    "apps/web/src/components/shared/cards/utils/EventCardImage.astro"     # toEventCardProps, via its three card callers
    "apps/web/src/components/experience/ExperienceCard.astro"             # toExperienceCardProps
    "apps/web/src/components/gastronomy/GastronomyCard.astro"             # toGastronomyCardProps
    "apps/web/src/pages/[lang]/eventos/[slug].astro"                      # toEventDetailProps
    # Producer verified: `toArticleCardProps` applies BOTH
    # `processEntityImages(extract: true)` and `toRenderableImageUrl` (the
    # author avatar), which is the field these two render.
    "apps/web/src/components/shared/cards/CardMeta.astro"                 # toArticleCardProps -> authorAvatar
    "apps/web/src/components/shared/cards/FeaturedArticleCard.astro"      # toArticleCardProps -> authorAvatar
    # Producer verified: `toArticleCardProps` / `toTestimonialCardProps` apply
    # `toRenderableImageUrl` to the avatar these sections optimise. Note their
    # in-file `isAllowedRemoteHost()` check is an SSRF allowlist that PERMITS
    # res.cloudinary.com — it is not what makes them CI-safe.
    "apps/web/src/components/sections/LatestArticlesSection.astro"        # toArticleCardProps -> authorAvatar
    "apps/web/src/components/sections/TestimonialsSection.astro"          # toTestimonialCardProps -> reviewerAvatar
    # Producer fixed in this change: pages/[lang]/publicaciones/[slug].astro
    # now applies `getMediaUrl(..., { preset: 'thumbnail' })` to `image`.
    "apps/web/src/components/post/PostRelatedEntityCard.astro"            # publicaciones/[slug].astro -> entity.image
    # `image` prop is typed `ImageMetadata`; its only caller
    # (pages/[lang]/index.astro) passes local ESM imports.
    "apps/web/src/components/CategoryTiles.astro"
)

if command -v rg >/dev/null 2>&1; then
    CALL_FILES=$(rg --no-messages -l -g '*.{ts,tsx,astro}' \
        'await getImage\(|getImage\(\{|<Image([[:space:]]|$)' apps/web/src || true)
else
    CALL_FILES=$(grep -rlE 'await getImage\(|getImage\(\{|<Image([[:space:]]|$)' \
        --include='*.ts' --include='*.tsx' --include='*.astro' apps/web/src || true)
fi

while IFS= read -r file; do
    [ -z "$file" ] && continue

    # A file that does not import astro:assets cannot be rendering Astro's
    # <Image>; `Promise<Image>` in the Cloudinary upload editors is an unrelated
    # domain type and matched the tag pattern.
    if ! grep -qF 'astro:assets' "$file"; then
        continue
    fi

    code=$(strip_comments "$file")

    # (1) The file consults the mode itself.
    if grep -qF "$MODE_FN(" <<< "$code"; then
        continue
    fi
    # (2) The src is resolved through a rewrite helper in this same file.
    if grep -qE 'getMediaUrl\(|extractFeaturedImage(Url)?\(|extractGallery(Items|Urls)\(|toRenderableImageUrl\(|buildImageEndpointUrl\(' <<< "$code"; then
        continue
    fi
    # NOTE: `!url.includes('placeholder')` is deliberately NOT an exemption.
    # It reads like a guard and is inert on a value that never went through a
    # rewrite: a real Cloudinary URL does not contain that substring, so it
    # sails straight through into `<Image>`. That is precisely how the
    # destination hero shipped a full-size SSR download with the check present
    # and green — verified by reverting the fix and watching this script pass.
    # The convention only means anything downstream of a rewrite, so the
    # rewrite is what has to be evidenced, here or at the producer.
    #
    # (3) Local ESM asset imports never leave the origin. Quote style differs
    # between .astro (double) and .ts (single), so both are accepted.
    if grep -qE "from [\"'][^\"']*assets/" <<< "$code"; then
        continue
    fi
    # (4) Audited, safety established at the producer.
    skip=false
    for traced in "${TRACED_SAFE[@]}"; do
        if [ "$file" = "$traced" ]; then
            skip=true
            break
        fi
    done
    if [ "$skip" = true ]; then
        continue
    fi

    FAILURES+=("$file renders <Image> or calls getImage() with no HOS-1144 evidence. Astro fetches a remote src SERVER-SIDE, so the browser DNS block does not cover it. Resolve the src through getMediaUrl()/extractFeaturedImage()/toRenderableImageUrl() in this file, or — if the rewrite genuinely happens in the caller — trace that producer and add this path to TRACED_SAFE with the producer named.")
done <<< "$CALL_FILES"

# ---------------------------------------------------------------------------
# 6. The PRODUCERS that TRACED_SAFE depends on still rewrite.
#
# A per-file allowlist cannot see the caller, so on its own it degrades into
# "trust me". Measured: reverting the `publicaciones/[slug].astro` fix left
# `PostRelatedEntityCard.astro` allowlisted and the script green while the bug
# was live again. These checks assert the other end of each traced chain.
# ---------------------------------------------------------------------------
echo "→ Producers behind the audited-safe list..."
TRANSFORMS='apps/web/src/lib/api/transforms.ts'
if [ ! -f "$TRANSFORMS" ]; then
    FAILURES+=("$TRANSFORMS is missing — twelve TRACED_SAFE entries depend on it.")
else
    tcode=$(strip_comments "$TRANSFORMS")
    # `extract: true` is what makes `processEntityImages` apply the rewrite at
    # all; its `if (!extract) return item;` branch hands back the raw payload.
    if ! grep -qF 'extract: true' <<< "$tcode"; then
        FAILURES+=("$TRANSFORMS no longer passes 'extract: true' to processEntityImages. That flag is what applies extractFeaturedImage(); without it every card component in TRACED_SAFE receives a raw Cloudinary URL.")
    fi
    if ! grep -qF 'extractFeaturedImage(' <<< "$tcode"; then
        FAILURES+=("$TRANSFORMS no longer calls extractFeaturedImage(). Every card component listed in TRACED_SAFE is safe only because it does.")
    fi
    if ! grep -qF 'toRenderableImageUrl(' <<< "$tcode"; then
        FAILURES+=("$TRANSFORMS no longer calls toRenderableImageUrl(). The author/reviewer avatars in CardMeta, FeaturedArticleCard, LatestArticlesSection and TestimonialsSection are safe only because it does.")
    fi
fi

# Per-ROUTE again, not per-file: this page also calls `getMediaUrl` for the
# author avatar, and that unrelated call satisfied a file-level check while the
# related-entity image went back to a raw `String()`. Measured — the revert
# passed a file-level check and fails this one.
POST_PAGE='apps/web/src/pages/[lang]/publicaciones/[slug].astro'
if [ -f "$POST_PAGE" ]; then
    related_body=$(function_body "$POST_PAGE" "toRelatedEntity")
    if [ -z "$related_body" ]; then
        FAILURES+=("$POST_PAGE no longer defines toRelatedEntity(). If it was renamed, update this guard — it produces the <Image> src PostRelatedEntityCard renders.")
    elif ! grep -vE '^[[:space:]]*(\*|//|/\*)' <<< "$related_body" | grep -qF 'getMediaUrl(' ; then
        FAILURES+=("toRelatedEntity() in $POST_PAGE does not call getMediaUrl(). It produces PostRelatedEntityCard's <Image> src, so a raw value there is a full-size server-side Cloudinary download on every post page.")
    fi
fi

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
echo ""
if [ ${#FAILURES[@]} -gt 0 ]; then
    echo "ERROR: the HOS-1144 CI cost guard is broken:"
    echo ""
    for failure in "${FAILURES[@]}"; do
        echo "  - $failure"
    done
    echo ""
    echo "  Background: 70.66 GB of Cloudinary bandwidth over 30 days, 98.5% of it"
    echo "  from GitHub Actions runners rendering seeded production image URLs."
    echo "  See $CANONICAL_MODULE for the full mechanism."
    echo ""
    exit 1
fi

echo "  OK — the switch, all four interception points (render + seed upload), the"
echo "  seed cut's ordering ahead of the download, both browser blocks and all four"
echo "  workflows are in place, and every <Image>/getImage() site in apps/web has"
echo "  traceable evidence that its src was rewritten before it got there."
echo ""
echo "All checks passed."
exit 0
