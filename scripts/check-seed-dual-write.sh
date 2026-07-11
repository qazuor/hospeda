#!/usr/bin/env bash
# =============================================================================
# check-seed-dual-write.sh  (HOS-25 T-024)
#
# Enforces the seed "dual-write rule" (spec R-5): a PR that changes BASELINE
# seed DATA that already lives in a deployed environment (staging/prod) MUST
# also add a new numbered data-migration in the same PR — otherwise a fresh
# `db:fresh` produces the correct row, but staging/prod (already seeded, never
# re-run from scratch) silently never receive the delta.
#
# -----------------------------------------------------------------------------
# DESIGN (reviewed before implementation, kept here for auditability)
# -----------------------------------------------------------------------------
#
# 1) Detection approach — diff-based file-pair heuristic, mirroring
#    scripts/check-schema-drift.sh's exit-code / messaging conventions but
#    diffing against the PR base ref (schema-drift instead re-derives drift
#    offline via `drizzle-kit generate`; there is no offline equivalent for
#    seed data, so a real base...HEAD diff is required here, the same way
#    the `security` CI job diffs semgrep findings against
#    `github.event.pull_request.base.sha`).
#
# 2) Guarded paths ("baseline data that lives in a live env") — determined by
#    reading which `packages/seed/src/required/*.seed.ts` seeders read which
#    `packages/seed/src/data/**` folders (required seeders run against every
#    live environment; `example/*.seed.ts` fixtures do not and are excluded):
#
#      packages/seed/src/data/amenity/**
#      packages/seed/src/data/attraction/**
#      packages/seed/src/data/destination/**
#      packages/seed/src/data/exchangeRate/**
#      packages/seed/src/data/exchangeRateConfig/**
#      packages/seed/src/data/feature/**
#      packages/seed/src/data/revalidationConfig/**
#      packages/seed/src/data/sponsorshipLevel/**
#      packages/seed/src/data/sponsorshipPackage/**
#      packages/seed/src/data/postTag/**
#      packages/seed/src/data/pointOfInterest/**
#      packages/seed/src/data/user/required/**
#
#    `packages/seed/src/data/tag/` is a MIXED folder: `internalTags.seed.ts`
#    and `systemTags.seed.ts` (required) glob `internal-*.json` / `system-*.json`
#    from it, while `example/tags.seed.ts` reads OTHER files from the SAME
#    folder via an explicit manifest list. Only the `internal-*` / `system-*`
#    files are guarded here; anything else under `data/tag/` is treated as
#    example data.
#
#    Additionally, the billing plan/limit/entitlement/addon/promo-code TS
#    constants in `packages/billing/src/config/*.config.ts` are guarded — this
#    is the exact precedent the 0001-0003 data-migrations already ported
#    (formerly hand-written `.plan.sql` extras files).
#
#    SCOPED OUT (v1, flagged for follow-up, see HOS-25 T-023 docs): several
#    OTHER `packages/seed/src/required/*.seed.ts` files carry their OWN inline
#    baseline-data constants rather than reading a `data/**/*.json` folder
#    (e.g. `rolePermissions.seed.ts`'s `ROLE_PERMISSIONS` map, `aiPrompts.seed.ts`,
#    `aiSettings.seed.ts`, `socialAutomation.seed.ts`, `contentModeration.seed.ts`,
#    `systemUser.seed.ts`). These are NOT path-diffable from data-only changes
#    without also flagging every logic change to those files (which would be
#    a much higher false-positive surface), so v1 deliberately does not guard
#    them. `example/**/*.json` data is excluded entirely: it is regenerated
#    non-deterministically on every full reseed (T-016/T-025 exceptions aside)
#    and does not need a live-env backfill.
#
# 3) "A new migration was added" — the diff must ADD (not modify) at least one
#    file matching `packages/seed/src/data-migrations/NNNN-*.ts` (4-digit
#    numeric prefix, matching the convention `make.ts`/`discover.ts` already
#    enforce).
#
# 4) Opt-out — a literal marker `[skip-seed-migration]` (optionally followed
#    by `: <reason>`) in the PR description OR any commit message in the
#    diff range. This mirrors the repo's existing magic-word convention
#    (`Closes HOS-N` in a PR body) rather than inventing a new label-based
#    mechanism — no CI guard in this repo currently reads PR labels, and a
#    marker requires no extra GitHub API call / permission. It is visible to
#    reviewers in the PR body (the standard review surface), same trust model
#    as other magic words in this repo.
#
#    False-positive profile: a genuinely-safe additive data change (e.g. a new
#    catalog entry nobody needs backfilled on already-seeded environments)
#    without the marker will fail loudly — the marker exists precisely to
#    unblock that case with an explicit, reviewable declaration.
#    False-negative profile: an author can add the marker to bypass a change
#    that DOES need a migration, with no automated defense beyond human PR
#    review (same trust boundary as every other magic-word convention here).
#    Also: this v1 guard cannot detect inline-constant changes in the
#    scoped-out `required/*.seed.ts` files above (see point 2) — a real gap,
#    reported to the orchestrator as a candidate future tightening.
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

# Guarded baseline-data directory prefixes (required seeders only — see design
# note 2 above). Bash regex (used with `=~`), anchored to repo-root-relative
# paths as `git diff --name-status` reports them.
REQUIRED_DATA_DIR_PATTERNS=(
    '^packages/seed/src/data/amenity/'
    '^packages/seed/src/data/attraction/'
    '^packages/seed/src/data/destination/'
    '^packages/seed/src/data/exchangeRate/'
    '^packages/seed/src/data/exchangeRateConfig/'
    '^packages/seed/src/data/feature/'
    '^packages/seed/src/data/revalidationConfig/'
    '^packages/seed/src/data/sponsorshipLevel/'
    '^packages/seed/src/data/sponsorshipPackage/'
    '^packages/seed/src/data/postTag/'
    '^packages/seed/src/data/pointOfInterest/'
    '^packages/seed/src/data/user/required/'
)

# data/tag/ is mixed (required + example share the folder) — only these
# filename prefixes are required data (matches internalTags.seed.ts /
# systemTags.seed.ts globs).
REQUIRED_TAG_FILE_PATTERN='^packages/seed/src/data/tag/(internal|system)-.*\.json$'

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

    git diff --name-status "${base}...HEAD" -- \
        'packages/seed/src/data' \
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

        for pattern in "${REQUIRED_DATA_DIR_PATTERNS[@]}"; do
            if [[ "${path}" =~ ${pattern} ]]; then
                baseline_changed=1
                matched_paths+=("${path}")
            fi
        done

        if [[ "${path}" =~ ${REQUIRED_TAG_FILE_PATTERN} ]]; then
            baseline_changed=1
            matched_paths+=("${path}")
        fi

        for billing_file in "${BILLING_CONFIG_FILES[@]}"; do
            if [[ "${path}" == "${billing_file}" ]]; then
                baseline_changed=1
                matched_paths+=("${path}")
            fi
        done
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
    echo "    pnpm --filter @repo/seed seed --data-migrate-make <slug>"
    echo "    (becomes  pnpm db:seed:make <slug>  once HOS-25 T-018 lands)"
    echo ""
    echo "  If this change genuinely needs no backfill on already-seeded environments,"
    echo "  add '${SKIP_MARKER}: <reason>' to the PR description and re-run."
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
