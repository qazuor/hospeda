#!/usr/bin/env bash
# =============================================================================
# check-drop-column-release-gap.sh  (HOS-601)
#
# Fails when a PR adds a Drizzle migration containing `DROP COLUMN` without an
# explicit, reviewable declaration that the code reading/writing that column
# already shipped WITHOUT it in an earlier, separately-deployed release.
#
# -----------------------------------------------------------------------------
# WHY THIS EXISTS (HOS-601)
# -----------------------------------------------------------------------------
# Migration 0090 dropped `accommodations.schedule` in the same release that
# stopped using it. Drizzle projects an explicit column list (never
# `SELECT *`), so from the instant the migration ran until the new container
# was fully live, every read of `accommodations` — the table that carries the
# site's SEO content — hit a column that no longer existed. Measured on the
# 2026-08-18 release: the API detail endpoint started 500ing 9 seconds after
# the migration applied, and the public web page served 404 (not 5xx) for
# **8 minutes 10 seconds** while the two containers swapped. A 404 reads to a
# crawler as "deindex this", which is a materially worse signal than "retry
# later" — see the HOS-601 Linear issue for the full timeline.
#
# The fix is not a smarter migration — it's TIMING: a column can only be
# dropped from the database in a release AFTER the release that already
# stopped reading/writing it in application code. That gap is what turns a
# `DROP COLUMN` from "instant break" into "no-op, the running code never asks
# for it again". See docs/guides/migrations.md ("Deploy order for DROP
# COLUMN...") for the full rule and the expand/contract pattern this repo
# already uses elsewhere (HOS-589 §6.3).
#
# -----------------------------------------------------------------------------
# WHAT THIS GUARD CAN AND CANNOT VERIFY
# -----------------------------------------------------------------------------
# "Did the code that used to read this column already ship, live, in an
# earlier release" is a fact about DEPLOY HISTORY, not about git state at PR
# time — this repo's own workflow separates "merged to staging" from
# "promoted to main" as a deliberate, human-gated step (see CLAUDE.md
# "Branch Workflow"), so even a clean `base...HEAD` diff cannot prove the
# column-removal commit actually reached production yet. A regex over
# application source is *also* unreliable here: HOS-620 (the companion
# finding on the very same migration) showed that "verified against the
# code" can assert the wrong thing entirely when nobody checked the DATA —
# and generic column names (`name`, `status`, `role`) would make a source
# grep for "still referenced anywhere" false-positive constantly, since the
# same identifier exists on dozens of unrelated tables/objects.
#
# So this guard does NOT try to auto-derive the answer. It forces the human
# fact to be stated where it can be reviewed: every `DROP COLUMN` a PR
# introduces must be named, one line each, in the PR description with a
# concrete citation (a PR number or a Linear issue id) to the earlier change
# that already stopped using it. Absence of the marker fails the build;
# presence does not "prove" the claim any more than `[skip-seed-migration]:
# <reason>` proves its own — both are the same trust boundary this repo
# already accepts elsewhere: reviewable-by-a-human, not machine-verified.
#
# -----------------------------------------------------------------------------
# DETECTION
# -----------------------------------------------------------------------------
# 1) Find migration files newly ADDED (git status "A") in this PR under
#    packages/db/src/migrations/*.sql.
# 2) Scan each for lines matching Drizzle's generated shape exactly:
#      ALTER TABLE "<table>" DROP COLUMN "<column>";
#    (anchored at line start so a comment merely *mentioning* the statement,
#    like 0069_mushy_captain_america.sql:35, is not mistaken for one).
# 3) For every unique `<table>.<column>` pair found, require a line in the PR
#    description matching:
#      [drop-column-release-gap: <table>.<column>]: <evidence>
#    where <evidence> contains a PR reference (`#123`) or a Linear issue id
#    (`HOS-123` / `BETA-123`). Missing or evidence-less markers fail the build
#    with the exact pairs still unaccounted for.
#
# -----------------------------------------------------------------------------
# TESTABILITY
# -----------------------------------------------------------------------------
# Mirrors check-seed-dual-write.sh's override convention so the DECISION
# logic can be exercised without a real git diff:
#
#   - `CHANGED_FILES_OVERRIDE` — synthetic `STATUS<TAB>PATH` lines instead of
#     `git diff --name-status` (same format as check-seed-dual-write.sh).
#   - `DROPPED_COLUMNS_OVERRIDE` — synthetic `table.column` lines instead of
#     reading + grepping the files named by CHANGED_FILES_OVERRIDE (skips
#     needing the fake files to exist on disk).
#   - `MARKER_TEXT_OVERRIDE` — synthetic PR-body/commit-message text instead
#     of the real PR body + commit-message scan.
#
# scripts/__tests__/check-drop-column-release-gap.test.ts drives the script
# via these overrides with synthetic inputs and asserts exit code + message.
#
# Usage (CI or local):
#   BASE_SHA=<sha-or-ref> PR_BODY="<body>" bash scripts/check-drop-column-release-gap.sh
#
# Exit codes: 0 = OK (no DROP COLUMN migration added, or every one carries a
# marker with evidence); 1 = at least one DROP COLUMN lacks one.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

MIGRATION_FILE_PATTERN='^packages/db/src/migrations/[0-9]{4}_.+\.sql$'

# -----------------------------------------------------------------------------
# compute_changed_migration_files: emits "STATUS<TAB>PATH" lines for
# base...HEAD restricted to the migrations dir, unless CHANGED_FILES_OVERRIDE
# is set (test injection point).
# -----------------------------------------------------------------------------
compute_changed_migration_files() {
    if [[ -n "${CHANGED_FILES_OVERRIDE:-}" ]]; then
        printf '%s\n' "${CHANGED_FILES_OVERRIDE}"
        return 0
    fi

    local base="${BASE_SHA:-}"
    if [[ -z "${base}" ]]; then
        echo "[drop-column-release-gap] ❌ BASE_SHA not set and no CHANGED_FILES_OVERRIDE provided." >&2
        echo "  Pass BASE_SHA=<ref> (e.g. origin/staging or the PR base SHA)." >&2
        return 1
    fi

    if [[ "${base}" =~ ^0+$ ]] || ! git rev-parse --verify "${base}" >/dev/null 2>&1; then
        echo "[drop-column-release-gap] ⚠ BASE_SHA '${base}' does not resolve (first push on a" >&2
        echo "  new branch, or shallow history) — skipping diff, nothing to compare against." >&2
        return 0
    fi

    git diff --no-renames --name-status "${base}...HEAD" -- 'packages/db/src/migrations'
}

# -----------------------------------------------------------------------------
# compute_dropped_columns: emits unique "table.column" lines found in newly
# ADDED migration files, unless DROPPED_COLUMNS_OVERRIDE is set (test
# injection point). `MIGRATION_FIXTURE_ROOT` (test injection point, mirrors
# check-seed-migration-schema-probe.sh's `MIGRATIONS_DIR_OVERRIDE`) redirects
# file CONTENT reads to a scratch directory keyed by basename, so tests can
# exercise the real extraction regex against fixture files without ever
# writing into the real packages/db/src/migrations/.
# -----------------------------------------------------------------------------
compute_dropped_columns() {
    if [[ -n "${DROPPED_COLUMNS_OVERRIDE:-}" ]]; then
        printf '%s\n' "${DROPPED_COLUMNS_OVERRIDE}"
        return 0
    fi

    local changed_files="$1"
    local status path

    while IFS=$'\t' read -r status path; do
        [[ -z "${path:-}" ]] && continue
        [[ "${status}" == A* ]] || continue
        [[ "${path}" =~ ${MIGRATION_FILE_PATTERN} ]] || continue

        local content_path="${path}"
        if [[ -n "${MIGRATION_FIXTURE_ROOT:-}" ]]; then
            content_path="${MIGRATION_FIXTURE_ROOT}/$(basename "${path}")"
        fi
        [[ -f "${content_path}" ]] || continue

        # Anchored at line start: a comment merely mentioning the statement
        # (e.g. "-- ALTER TABLE ... DROP COLUMN ... on the next line") starts
        # with "--", not "ALTER", so it is never mistaken for the real thing.
        # `|| true`: grep exits 1 on zero matches (a migration with no DROP
        # COLUMN at all, the common case) — with `set -e`/`pipefail` active,
        # an unguarded non-zero here would abort the whole script rather than
        # simply yielding "nothing found for this file".
        local statements
        statements="$(grep -oE '^ALTER TABLE "[^"]+" DROP COLUMN "[^"]+";' "${content_path}" 2>/dev/null || true)"
        [[ -z "${statements}" ]] && continue

        local stmt table column
        while IFS= read -r stmt; do
            [[ -z "${stmt}" ]] && continue
            table="$(sed -E 's/^ALTER TABLE "([^"]+)".*/\1/' <<<"${stmt}")"
            column="$(sed -E 's/.*DROP COLUMN "([^"]+)";$/\1/' <<<"${stmt}")"
            printf '%s.%s\n' "${table}" "${column}"
        done <<<"${statements}"
    done <<<"${changed_files}" | sort -u
}

# -----------------------------------------------------------------------------
# compute_marker_text: assembles the text searched for evidence markers,
# unless MARKER_TEXT_OVERRIDE is set (test injection point).
# -----------------------------------------------------------------------------
compute_marker_text() {
    if [[ -n "${MARKER_TEXT_OVERRIDE:-}" ]]; then
        printf '%s\n' "${MARKER_TEXT_OVERRIDE}"
        return 0
    fi

    local text="${PR_BODY:-}"
    local base="${BASE_SHA:-}"
    if [[ -n "${base}" ]] && git rev-parse --verify "${base}" >/dev/null 2>&1; then
        text="${text}
$(git log "${base}..HEAD" --format=%B 2>/dev/null || true)"
    fi
    printf '%s\n' "${text}"
}

# -----------------------------------------------------------------------------
# has_evidence_marker: pure predicate. Given the marker text and one
# "table.column" pair, returns 0 if a marker line for that exact pair carries
# a PR (#123) or Linear issue (HOS-123 / BETA-123) citation.
# -----------------------------------------------------------------------------
has_evidence_marker() {
    local marker_text="$1"
    local pair="$2"
    # Escape regex metacharacters in the table.column pair (the literal "."
    # would otherwise match any character).
    local escaped_pair
    escaped_pair="$(printf '%s' "${pair}" | sed -E 's/[.[\*^$]/\\&/g')"

    local line
    while IFS= read -r line; do
        [[ "${line}" =~ \[drop-column-release-gap:\ *${escaped_pair}\]: ]] || continue
        if [[ "${line}" =~ (#[0-9]+|HOS-[0-9]+|BETA-[0-9]+) ]]; then
            return 0
        fi
    done <<<"${marker_text}"
    return 1
}

# -----------------------------------------------------------------------------
# decide: pure decision function. Reads dropped-column pairs + marker text,
# prints a message, returns 0 (pass) or 1 (fail).
# -----------------------------------------------------------------------------
decide() {
    local dropped_columns="$1"
    local marker_text="$2"

    if [[ -z "${dropped_columns//[[:space:]]/}" ]]; then
        echo "[drop-column-release-gap] OK: no DROP COLUMN migration added."
        return 0
    fi

    local -a missing=()
    local -a verified=()
    local pair
    while IFS= read -r pair; do
        [[ -z "${pair}" ]] && continue
        if has_evidence_marker "${marker_text}" "${pair}"; then
            verified+=("${pair}")
        else
            missing+=("${pair}")
        fi
    done <<<"${dropped_columns}"

    if [[ "${#missing[@]}" -eq 0 ]]; then
        echo "[drop-column-release-gap] OK: every dropped column carries a release-gap marker:"
        printf '  %s\n' "${verified[@]}"
        return 0
    fi

    echo "[drop-column-release-gap] FAIL: this PR drops a column without evidence that the"
    echo "  code reading/writing it already shipped, live, in an earlier release:"
    printf '  %s\n' "${missing[@]}"
    echo ""
    echo "  A DROP COLUMN in the same release as the code that stops using it breaks the"
    echo "  OLD container from the instant the migration runs until the new one is fully"
    echo "  live — measured at 8m10s of accommodations 404s on the 2026-08-18 release"
    echo "  (HOS-601). Drizzle projects an explicit column list, never SELECT *."
    echo ""
    echo "  Fix: split this into two releases — the code change lands first, deploys,"
    echo "  THEN the DROP COLUMN migration follows in a later PR. Once that earlier"
    echo "  change is live, add one line per column to THIS PR's description:"
    echo ""
    echo "    [drop-column-release-gap: <table>.<column>]: <evidence — a PR number"
    echo "    (#123) or Linear issue (HOS-123 / BETA-123) proving the code shipped"
    echo "    without this column in an earlier release>"
    echo ""
    echo "  See docs/guides/migrations.md (\"Deploy order for DROP COLUMN\") for the"
    echo "  full rule and a worked example."
    return 1
}

main() {
    local dropped_columns
    if [[ -n "${DROPPED_COLUMNS_OVERRIDE:-}" ]]; then
        # Test injection point — skip the real diff entirely (no BASE_SHA
        # needed) so decision-logic tests never depend on git state.
        dropped_columns="$(compute_dropped_columns '')"
    else
        local changed_files
        changed_files="$(compute_changed_migration_files)"
        dropped_columns="$(compute_dropped_columns "${changed_files}")"
    fi

    local marker_text
    marker_text="$(compute_marker_text)"

    decide "${dropped_columns}" "${marker_text}"
}

# Allow sourcing this file (for tests) without executing main.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main
fi
