#!/usr/bin/env bash
# =============================================================================
# check-seed-dual-write.sh  (HOS-25 T-024; hardened to fail-closed in HOS-173)
#
# Enforces the seed "dual-write rule" (spec R-5): a PR that changes BASELINE
# seed DATA that already lives in a deployed environment (staging/prod) MUST
# also add a new numbered data-migration in the same PR — otherwise a fresh
# `db:fresh` produces the correct row, but staging/prod (already seeded, never
# re-run from scratch) silently never receive the delta.
#
# -----------------------------------------------------------------------------
# DESIGN (HOS-173 rewrite — fail-closed by default, kept here for auditability)
# -----------------------------------------------------------------------------
#
# HISTORY: v1 (HOS-25) was an ALLOWLIST of `required`-seeder data paths and was
# FAIL-OPEN by construction — any seed source not on the list was invisible,
# regardless of whether its data was deterministic and prod-bound. That let the
# `partners` catalog (6 deterministic fixtures, added 2026-07-08, one day after
# the guard went live) ship with zero CI signal; `partners` is still empty in
# prod (HOS-172). Four other curated sources (`gastronomy`, `hostTrade`,
# `postSponsor`, `postSponsorship`) plus the inline `experiences` fixtures sat
# in the identical blind zone, safe only by chronological luck. The exemption
# depended on HOW a seeder was registered (which orchestrator ran it), not on
# what its data represented — and the premise behind it ("example data is
# regenerated non-deterministically on every reseed") is factually FALSE for
# this package: `@repo/seed` has no faker dependency; every fixture (required
# AND example) gets a deterministic UUIDv5 id and re-seeds byte-identically.
#
# 1) Detection approach — diff-based file-pair heuristic, mirroring
#    scripts/check-schema-drift.sh's exit-code / messaging conventions but
#    diffing against the PR base ref (there is no offline equivalent for seed
#    data, so a real base...HEAD diff is required, the same way the `security`
#    CI job diffs findings against the PR base sha).
#
# 2) Guarded surface — FAIL-CLOSED DEFAULT. Everything under
#    `packages/seed/src/data/**` is guarded by default (so a brand-new data
#    folder — the exact partners shape — is caught with nobody needing to
#    remember to add it to a list), MINUS a short, explicit, reviewed EXEMPTION
#    list of demo-only sources. The axis is NOT `required` vs `example`; it is
#    "curated content a live environment is meant to carry" (guarded) vs
#    "synthetic demo-only content that must never represent a real environment"
#    (exempt). A `partner` fixture and a fake accommodation share the same
#    `runExampleSeeds()` registration bucket but are opposite for dual-write
#    purposes, so registration bucket cannot be the discriminator.
#
#    EXEMPT_DATA_DIR_PATTERNS below enumerates the demo-only `data/**` folders
#    (accommodations, events, posts, reviews, bookmarks, and their join/aux
#    tables). Two folders are MIXED and handled specially:
#      - `data/tag/`  — only `internal-*` / `system-*` files are required
#        (globbed by internalTags/systemTags required seeders); every other
#        file is example passthrough and is exempt.
#      - `data/user/` — only `data/user/required/**` is required; `user/example/`
#        (and anything else under `user/`) is demo-only and exempt.
#    Everything else under `data/**` — amenity, attraction, destination,
#    exchangeRate(+Config), feature, revalidationConfig, sponsorshipLevel,
#    sponsorshipPackage, postTag, pointOfInterest, poiCategory (all required),
#    AND partner, gastronomy, hostTrade, postSponsor, postSponsorship (curated
#    prod content, the five formerly-escaped sources) — is guarded by default.
#
#    INLINE-CONSTANT files: a handful of seeders bake their fixtures into an
#    inline TS constant instead of a `data/**/*.json` folder, so a path-glob
#    over `data/**` cannot see them. The ones carrying PROD-BOUND data are
#    guarded as NAMED FILES on ANY diff to the whole file (coarse-grained — a
#    pure logic refactor also trips the guard and needs the opt-out marker;
#    accepted because these files change rarely and the alternative is a silent
#    data escape). INLINE_CONSTANT_FILES (prod-content only):
#      - packages/seed/src/example/experiences.seed.ts   (SPEC-240 commerce
#        listings — deterministic inline array, no data/ folder at all)
#      - packages/seed/src/example/entityTagAssignments.seed.ts  (inline
#        r_entity_tag assignments that attach tags to GUARDED destination
#        catalog rows — Chajarí/Colón — and demo events; guarded because a
#        change to which real destination is tagged is prod-relevant)
#      - packages/seed/src/example/userTags.seed.ts  (inline user-tag
#        assignments that attach tags to the GUARDED required admin-user)
#      - packages/seed/src/required/rolePermissions.seed.ts
#      - packages/seed/src/required/aiPrompts.seed.ts
#      - packages/seed/src/required/aiSettings.seed.ts
#      - packages/seed/src/required/socialAutomation.seed.ts
#      - packages/seed/src/required/contentModeration.seed.ts
#      - packages/seed/src/required/systemUser.seed.ts
#    (The `required/billing*.seed.ts` and `required/partnerPlan/commercePlan`
#    seeders are NOT here: their data lives in `packages/billing/src/config/
#    *.config.ts`, already guarded below — the seeders only read it.)
#
#    DEMO-ONLY inline seeders — deliberately NOT guarded (audited HOS-173, not an
#    omission). Three other `example/*.seed.ts` files bake fixtures into inline
#    constants with no live `data/` folder, but they attach ONLY to demo entities
#    (fake accommodations, demo posts) that are themselves exempt, so — like
#    their exempt data-folder siblings — they never need a live-env backfill and
#    requiring a migration on every edit would be pure false-positive friction:
#      - packages/seed/src/example/accommodationExternalListings.seed.ts   (attaches
#        external-listing rows to demo accommodations only)
#      - packages/seed/src/example/accommodationExternalReputation.seed.ts  (ditto,
#        reputation rows on demo accommodations only)
#      - packages/seed/src/example/postTagAssignments.seed.ts   (post↔PostTag
#        rows on demo posts only)
#    (If any of these ever attaches to a guarded entity or gains prod-bound
#    content, move it to INLINE_CONSTANT_FILES — as entityTagAssignments/userTags
#    were. The `scripts/__tests__` suite pins both the exemption of these three
#    AND the guarding of entityTagAssignments/userTags so the split stays visible.)
#
#    Additionally, the billing plan/limit/entitlement/addon/promo-code TS
#    constants in `packages/billing/src/config/*.config.ts` are guarded — the
#    exact precedent the 0001-0003 data-migrations already ported.
#
#    NOT COVERED (residual, see HOS-173 §6.2 / OQ-3): a FUTURE prod-content
#    inline-constant seeder added under `example/`/`required/` with neither a
#    `data/` folder nor an entry in INLINE_CONSTANT_FILES would still escape.
#    The fix for that class is to extract inline data into `data/**/*.json`
#    files (so the default path-glob covers them); tracked as a follow-up.
#
# 3) "A new migration was added" — the diff must ADD (not modify) at least one
#    file matching `packages/seed/src/data-migrations/NNNN-*.ts` (4-digit
#    numeric prefix, matching the convention `make.ts`/`discover.ts` enforce).
#
# 4) Opt-out — a literal marker `[skip-seed-migration]` (optionally followed
#    by `: <reason>`) in the PR description OR any commit message in the diff
#    range, mirroring the repo's existing magic-word convention. Since the whole
#    data surface is now default-guarded, this marker is the escape hatch for a
#    genuinely-safe additive change that needs no backfill. VALID reasons are a
#    CLOSED set (enforced by REVIEW, not tooling — see HOS-173 NG-5):
#      a) "demo-only: synthetic content, must never represent a real
#         environment" — the only category that currently exists here, and the
#         reason a new demo fixture not yet on EXEMPT_DATA_DIR_PATTERNS would use.
#      b) "non-deterministic: <the actual regeneration mechanism, e.g. a faker
#         call or timestamp-based id>" — kept available for a hypothetical
#         future fixture that truly re-randomizes. No such case exists today;
#         the bare word "non-deterministic" with no described, diff-visible
#         mechanism is NOT an acceptable reason (that was v1's false premise).
#
#    False-positive profile: a genuinely-safe additive data change without the
#    marker fails loudly — the marker unblocks it with an explicit, reviewable
#    declaration. False-negative profile: an author can add the marker to bypass
#    a change that DOES need a migration, defended only by human PR review (same
#    trust boundary as every other magic-word convention here).
#
# -----------------------------------------------------------------------------
# TESTABILITY
# -----------------------------------------------------------------------------
# The "compute changed files" and "decide pass/fail" concerns are split so the
# decision logic can be exercised without a real git diff:
#
#   - `CHANGED_FILES_OVERRIDE` (env) — if set, used verbatim instead of running
#     `git diff --name-status`. Format: one `STATUS<TAB>PATH` pair per line
#     (the same format `git diff --name-status` emits).
#   - `MARKER_TEXT_OVERRIDE` (env) — if set, used verbatim instead of the real
#     PR body + commit-message scan, as the text searched for the opt-out
#     marker.
#
# scripts/__tests__/check-seed-dual-write.test.ts drives the script via both
# overrides with synthetic inputs and asserts exit code + message content.
#
# Usage (CI or local):
#   BASE_SHA=<sha-or-ref> bash scripts/check-seed-dual-write.sh
#
# Exit codes: 0 = OK (no guarded data changed, or a migration/opt-out is
# present); 1 = guarded data changed with neither a new migration nor opt-out.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

SKIP_MARKER='[skip-seed-migration]'

# Everything under this prefix is guarded by DEFAULT (fail-closed), minus the
# EXEMPT_DATA_DIR_PATTERNS / mixed-folder rules below. Bash regex (used with
# `=~`), anchored to repo-root-relative paths as `git diff --name-status`
# reports them.
GUARDED_DATA_ROOT_PATTERN='^packages/seed/src/data/'

# Demo-only `data/**` folders: synthetic content that must never represent a
# real environment, so it never needs a live-env backfill. Subtracted from the
# default-guarded surface. (data/tag/ and data/user/ are mixed — handled by the
# dedicated patterns below, NOT listed here.)
EXEMPT_DATA_DIR_PATTERNS=(
    '^packages/seed/src/data/accommodation/'
    '^packages/seed/src/data/accommodationExternalListing/'
    '^packages/seed/src/data/accommodationExternalReputation/'
    '^packages/seed/src/data/accommodationReview/'
    '^packages/seed/src/data/bookmark/'
    '^packages/seed/src/data/destinationReview/'
    '^packages/seed/src/data/event/'
    '^packages/seed/src/data/eventLocation/'
    '^packages/seed/src/data/eventOrganizer/'
    '^packages/seed/src/data/post/'
    '^packages/seed/src/data/userBookmarkCollection/'
)

# data/tag/ is mixed: only internal-*/system-* files are required (globbed by
# internalTags.seed.ts / systemTags.seed.ts); every other file is example
# passthrough (read via an explicit manifest by example/tags.seed.ts).
REQUIRED_TAG_FILE_PATTERN='^packages/seed/src/data/tag/(internal|system)-.*\.json$'

# data/user/ is mixed: only user/required/** is required; user/example/** (and
# anything else under user/) is demo-only.
REQUIRED_USER_DIR_PATTERN='^packages/seed/src/data/user/required/'
TAG_DIR_PATTERN='^packages/seed/src/data/tag/'
USER_DIR_PATTERN='^packages/seed/src/data/user/'

# Inline-constant seeders: fixtures baked into a TS constant, no data/**/*.json
# folder to path-match. Guarded as exact filenames on ANY diff (coarse). See
# design note 2 above.
INLINE_CONSTANT_FILES=(
    'packages/seed/src/example/experiences.seed.ts'
    # entityTagAssignments / userTags bake inline assignments that attach to
    # GUARDED entities (real destination catalog rows like Chajarí/Colón, and
    # the required admin-user) — not purely demo entities — so a change to which
    # real row gets tagged is prod-relevant and must not escape silently.
    'packages/seed/src/example/entityTagAssignments.seed.ts'
    'packages/seed/src/example/userTags.seed.ts'
    'packages/seed/src/required/rolePermissions.seed.ts'
    'packages/seed/src/required/aiPrompts.seed.ts'
    'packages/seed/src/required/aiSettings.seed.ts'
    'packages/seed/src/required/socialAutomation.seed.ts'
    'packages/seed/src/required/contentModeration.seed.ts'
    'packages/seed/src/required/systemUser.seed.ts'
)

# Billing plan/limit/entitlement/addon/promo-code TS constants (023-025
# precedent).
BILLING_CONFIG_FILES=(
    'packages/billing/src/config/plans.config.ts'
    'packages/billing/src/config/limits.config.ts'
    'packages/billing/src/config/entitlements.config.ts'
    'packages/billing/src/config/addons.config.ts'
    'packages/billing/src/config/promo-codes.config.ts'
)

# Matches make.ts / discover.ts's own NNNN-slug.ts convention.
MIGRATION_FILE_PATTERN='^packages/seed/src/data-migrations/[0-9]{4}-.+\.ts$'

# -----------------------------------------------------------------------------
# compute_changed_files: emits "STATUS<TAB>PATH" lines for base...HEAD, unless
# CHANGED_FILES_OVERRIDE is set (test injection point).
# -----------------------------------------------------------------------------
compute_changed_files() {
    if [[ -n "${CHANGED_FILES_OVERRIDE:-}" ]]; then
        printf '%s\n' "${CHANGED_FILES_OVERRIDE}"
        return 0
    fi

    local base="${BASE_SHA:-}"
    if [[ -z "${base}" ]]; then
        echo "[seed-dual-write] ❌ BASE_SHA not set and no CHANGED_FILES_OVERRIDE provided." >&2
        echo "  Pass BASE_SHA=<ref> (e.g. origin/staging or the PR base SHA)." >&2
        return 1
    fi

    # github.event.before is all-zeros on a branch's first push (no prior
    # commit to diff against). Fail OPEN (empty diff) rather than crashing CI
    # on an unrelated edge case — this only affects brand-new branches, and
    # the guard runs again on every subsequent push/PR sync.
    if [[ "${base}" =~ ^0+$ ]] || ! git rev-parse --verify "${base}" >/dev/null 2>&1; then
        echo "[seed-dual-write] ⚠ BASE_SHA '${base}' does not resolve (first push on a new" >&2
        echo "  branch, or shallow history) — skipping diff, nothing to compare against." >&2
        return 0
    fi

    # Diff roots: `data` (default-guarded surface + mixed folders), the two
    # inline-constant orchestrator dirs (`example`, `required` — so the named
    # INLINE_CONSTANT_FILES show up in the diff), `billing/config`, and
    # `data-migrations` (to detect the accompanying migration).
    #
    # `--no-renames` keeps every diff line a strict A/M/D with a single path, so
    # the exact-equality checks in is_guarded_path (INLINE_CONSTANT_FILES /
    # BILLING_CONFIG_FILES) can never be defeated by git emitting an
    # `R<score><TAB>old<TAB>new` line that the two-field `read` would collapse
    # into one path string. (diff.renames defaults ON in modern git.)
    git diff --no-renames --name-status "${base}...HEAD" -- \
        'packages/seed/src/data' \
        'packages/seed/src/example' \
        'packages/seed/src/required' \
        'packages/billing/src/config' \
        'packages/seed/src/data-migrations'
}

# -----------------------------------------------------------------------------
# compute_marker_text: assembles the text searched for the opt-out marker,
# unless MARKER_TEXT_OVERRIDE is set (test injection point).
# -----------------------------------------------------------------------------
compute_marker_text() {
    if [[ -n "${MARKER_TEXT_OVERRIDE:-}" ]]; then
        printf '%s\n' "${MARKER_TEXT_OVERRIDE}"
        return 0
    fi

    # PR_BODY is provided by the workflow (github.event.pull_request.body);
    # empty on push events. Commit messages in range are the fallback so a
    # local/manual invocation (or a push-triggered run) still works.
    local text="${PR_BODY:-}"
    local base="${BASE_SHA:-}"
    if [[ -n "${base}" ]] && git rev-parse --verify "${base}" >/dev/null 2>&1; then
        text="${text}
$(git log "${base}..HEAD" --format=%B 2>/dev/null || true)"
    fi
    printf '%s\n' "${text}"
}

# -----------------------------------------------------------------------------
# is_guarded_path: pure predicate. Given a single repo-relative path, returns 0
# (guarded) or 1 (not guarded), implementing the fail-closed default + exemptions.
# -----------------------------------------------------------------------------
is_guarded_path() {
    local path="$1"

    # Exact-match guarded files (billing config + inline-constant seeders).
    local f
    for f in "${BILLING_CONFIG_FILES[@]}" "${INLINE_CONSTANT_FILES[@]}"; do
        [[ "${path}" == "${f}" ]] && return 0
    done

    # Everything under data/ is guarded by default, minus exemptions.
    if [[ "${path}" =~ ${GUARDED_DATA_ROOT_PATTERN} ]]; then
        # Mixed folder: tag — guard only internal-*/system-*.
        if [[ "${path}" =~ ${TAG_DIR_PATTERN} ]]; then
            [[ "${path}" =~ ${REQUIRED_TAG_FILE_PATTERN} ]] && return 0
            return 1
        fi
        # Mixed folder: user — guard only user/required/**.
        if [[ "${path}" =~ ${USER_DIR_PATTERN} ]]; then
            [[ "${path}" =~ ${REQUIRED_USER_DIR_PATTERN} ]] && return 0
            return 1
        fi
        # Explicit demo-only exemptions.
        local ex
        for ex in "${EXEMPT_DATA_DIR_PATTERNS[@]}"; do
            [[ "${path}" =~ ${ex} ]] && return 1
        done
        # Default: guarded.
        return 0
    fi

    return 1
}

# -----------------------------------------------------------------------------
# decide: pure decision function. Reads changed-files + marker text, prints a
# message, returns 0 (pass) or 1 (fail).
# -----------------------------------------------------------------------------
decide() {
    local changed_files="$1"
    local marker_text="$2"

    local baseline_changed=0
    local -a matched_paths=()

    while IFS=$'\t' read -r status path; do
        [[ -z "${path:-}" ]] && continue
        if is_guarded_path "${path}"; then
            baseline_changed=1
            matched_paths+=("${path}")
        fi
    done <<<"${changed_files}"

    if [[ "${baseline_changed}" -eq 0 ]]; then
        echo "[seed-dual-write] OK: no guarded baseline seed-data path changed."
        return 0
    fi

    local new_migration=0
    while IFS=$'\t' read -r status path; do
        [[ -z "${path:-}" ]] && continue
        # Only newly ADDED files count ("A" status; git also emits "A" for
        # the add-side of a rename pair as "R100<TAB>old<TAB>new" which this
        # simple two-column read does not fully parse — acceptable: renaming
        # an existing migration file is not a real "new migration added").
        if [[ "${status}" == A* && "${path}" =~ ${MIGRATION_FILE_PATTERN} ]]; then
            new_migration=1
        fi
    done <<<"${changed_files}"

    if [[ "${new_migration}" -eq 1 ]]; then
        echo "[seed-dual-write] OK: baseline data changed AND a new data-migration was added:"
        printf '  %s\n' "${matched_paths[@]}"
        return 0
    fi

    if [[ "${marker_text}" == *"${SKIP_MARKER}"* ]]; then
        echo "[seed-dual-write] OK (opt-out): baseline data changed without a new migration,"
        echo "  but the '${SKIP_MARKER}' marker was found in the PR body/commit messages —"
        echo "  skipping per the author's explicit declaration."
        printf '  %s\n' "${matched_paths[@]}"
        return 0
    fi

    echo "[seed-dual-write] FAIL: baseline seed data changed without an accompanying migration:"
    printf '  %s\n' "${matched_paths[@]}"
    echo ""
    echo "  This data already exists in staging/prod. A fresh DB will seed the new"
    echo "  value correctly, but already-seeded environments never receive it unless"
    echo "  a numbered data-migration backfills it (HOS-25 dual-write rule, spec R-5)."
    echo ""
    echo "  Fix: scaffold a new migration and commit it in this PR:"
    echo "    pnpm db:seed:make <slug>"
    echo ""
    echo "  If this change genuinely needs no backfill on already-seeded environments"
    echo "  (e.g. demo-only synthetic content), add '${SKIP_MARKER}: <reason>' to the"
    echo "  PR description and re-run. Valid reasons are a closed set — see the design"
    echo "  note in this script (opt-out); the bare word 'non-deterministic' is not one."
    return 1
}

main() {
    local changed_files
    changed_files="$(compute_changed_files)"

    local marker_text
    marker_text="$(compute_marker_text)"

    decide "${changed_files}" "${marker_text}"
}

# Allow sourcing this file (for tests) without executing main.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main
fi
