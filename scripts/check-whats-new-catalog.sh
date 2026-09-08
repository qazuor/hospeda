#!/usr/bin/env bash
# =============================================================================
# check-whats-new-catalog.sh
#
# HOS-1214, AC-11.
#
# -----------------------------------------------------------------------------
# WHAT IT PROVES
# -----------------------------------------------------------------------------
#   `apps/api/src/data/whats-new/whats-new.ts` is a hand-edited (and, after
#   HOS-1214, sign-off-authored) TS array parsed once at API boot. Three
#   invariants documented in that file's own prose have no enforcement:
#
#   1. No two LIVE entries share an `id` (a stale `seenIds` collision would
#      silently mark a new entry as already seen for whoever had dismissed
#      the earlier one).
#   2. No LIVE entry reuses an id that was already retired into
#      `RETIRED_WHATS_NEW_IDS` (HOS-1214 F-4) — same failure mode, via the
#      archival path instead of a same-batch typo.
#   3. Entries are declared **newest-first** by `publishedAt`, the ordering
#      convention every author since HOS-964 has followed by hand. Entries
#      still carrying the unresolved `'on-promotion'` marker (HOS-1214 D-1)
#      have no date yet and do not participate in this check.
#
#   This guard fails, naming the offending id(s), whenever one of the three
#   is violated.
#
# -----------------------------------------------------------------------------
# WHAT IT IS ANCHORED ON
# -----------------------------------------------------------------------------
#   The target file is plain TypeScript, not JSON, so this guard does not
#   parse it as a language — it extracts two flat, ordered lists with grep/awk
#   and reasons about those:
#
#   - Full-line comments (`//`, `*`, `/*` after leading whitespace) are
#     stripped BEFORE any extraction. This is what keeps the commented-out
#     "Adding an entry" example in the module docblock from being read as a
#     live entry, and JSDoc prose from being read as a retired id.
#   - `RETIRED_WHATS_NEW_IDS` ids are read from the block between that
#     declaration and the first `]);` that follows it — never from anywhere
#     else in the file, so a kebab-case string quoted in an unrelated comment
#     or example cannot be mistaken for a retired id.
#   - Live ids/dates are read from `id: '...'` / `publishedAt: '...'` pairs
#     appearing (in file order) after `export const whatsNewEntries`. Order
#     is preserved positionally: the Nth id extracted pairs with the Nth
#     `publishedAt` extracted, which holds as long as every entry object
#     states both fields (required by `WhatsNewEntrySchema` for `id`; either a
#     real date or the marker for `publishedAt`).
#
# -----------------------------------------------------------------------------
# TESTABILITY / POSITIVE CONTROL
# -----------------------------------------------------------------------------
#   `WHATS_NEW_CATALOG_FILE_OVERRIDE` (env, absolute or repo-relative path)
#   replaces the target file, so the guard can be pointed at a fixture that
#   reintroduces a duplicate id, a retired-id reuse, or a broken order and be
#   observed to exit 1 — mirroring `SCAN_FILES_OVERRIDE` in
#   check-no-trial-to-mercadopago.sh and `CHANGED_FILES_OVERRIDE` in
#   check-seed-dual-write.sh.
#
# Exit codes: 0 = catalog is internally consistent; 1 = at least one
# violation (duplicate id, retired-id reuse, or broken order).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

DEFAULT_FILE="apps/api/src/data/whats-new/whats-new.ts"
FILE="${WHATS_NEW_CATALOG_FILE_OVERRIDE:-${DEFAULT_FILE}}"

echo "=== Checking What's New catalog integrity (HOS-1214 AC-11) ==="
echo ""

if [[ ! -f "${FILE}" ]]; then
    echo "ERROR: catalog file not found: ${FILE}" >&2
    exit 1
fi

# Strip full-line comments so JSDoc prose and the commented-out "Adding an
# entry" example are never read as live data.
CLEANED="$(grep -vE '^[[:space:]]*(//|\*|/\*)' "${FILE}")"

# -----------------------------------------------------------------------------
# Extract retired ids: only from the RETIRED_WHATS_NEW_IDS declaration block,
# up to (and including) the first closing `]);` that follows it.
# -----------------------------------------------------------------------------
RETIRED_BLOCK="$(printf '%s\n' "${CLEANED}" | awk '
    /RETIRED_WHATS_NEW_IDS/ { capture=1 }
    capture { print }
    capture && /\]\)/ { exit }
')"
RETIRED_IDS="$(printf '%s\n' "${RETIRED_BLOCK}" | grep -oE "'[a-z0-9-]+'" | tr -d "'" | sort -u || true)"

# -----------------------------------------------------------------------------
# Extract live ids and publishedAt values, in file order, from everything
# after `export const whatsNewEntries`.
# -----------------------------------------------------------------------------
ENTRIES_BLOCK="$(printf '%s\n' "${CLEANED}" | awk '
    /export const whatsNewEntries/ { capture=1 }
    capture { print }
')"

if [[ -z "${ENTRIES_BLOCK}" ]]; then
    echo "ERROR: could not find 'export const whatsNewEntries' in ${FILE}." >&2
    echo "  The guard's extraction is anchored on that declaration — if it" >&2
    echo "  was renamed, update this script." >&2
    exit 1
fi

LIVE_IDS_RAW="$(printf '%s\n' "${ENTRIES_BLOCK}" | grep -oE "id: *'[a-z0-9-]+'" | grep -oE "'[a-z0-9-]+'" | tr -d "'" || true)"
LIVE_DATES_RAW="$(printf '%s\n' "${ENTRIES_BLOCK}" | grep -oE "publishedAt: *'[^']+'" | grep -oE "'[^']+'" | tr -d "'" || true)"

ID_ARR=()
if [[ -n "${LIVE_IDS_RAW}" ]]; then
    while IFS= read -r line; do
        ID_ARR+=("${line}")
    done <<<"${LIVE_IDS_RAW}"
fi

DATE_ARR=()
if [[ -n "${LIVE_DATES_RAW}" ]]; then
    while IFS= read -r line; do
        DATE_ARR+=("${line}")
    done <<<"${LIVE_DATES_RAW}"
fi

echo "  Found ${#ID_ARR[@]} live entr$([ "${#ID_ARR[@]}" -eq 1 ] && echo y || echo ies)."
echo ""

FAILURES=0

# -----------------------------------------------------------------------------
# Check 1 — duplicate id among live entries.
# -----------------------------------------------------------------------------
if [[ ${#ID_ARR[@]} -gt 0 ]]; then
    DUPES="$(printf '%s\n' "${ID_ARR[@]}" | sort | uniq -d)"
    if [[ -n "${DUPES}" ]]; then
        echo "ERROR: duplicate id(s) among live entries:"
        while IFS= read -r dup; do
            [[ -z "${dup}" ]] && continue
            echo "  - ${dup}"
        done <<<"${DUPES}"
        echo ""
        FAILURES=1
    fi
fi

# -----------------------------------------------------------------------------
# Check 2 — a live id reused from RETIRED_WHATS_NEW_IDS.
# -----------------------------------------------------------------------------
if [[ -n "${RETIRED_IDS}" && ${#ID_ARR[@]} -gt 0 ]]; then
    for id in "${ID_ARR[@]}"; do
        if printf '%s\n' "${RETIRED_IDS}" | grep -qxF "${id}"; then
            echo "ERROR: id '${id}' is reused from RETIRED_WHATS_NEW_IDS."
            echo "  A retired id must never come back — a stale seenIds entry"
            echo "  in a user's settings would silently mark this new entry as"
            echo "  already seen. Pick a different id."
            echo ""
            FAILURES=1
        fi
    done
fi

# -----------------------------------------------------------------------------
# Check 3 — newest-first ordering. Entries carrying the unresolved
# 'on-promotion' marker have no date yet and are skipped (HOS-1214 D-1).
# -----------------------------------------------------------------------------
PREV_EPOCH=""
PREV_ID=""
for i in "${!ID_ARR[@]}"; do
    id="${ID_ARR[$i]}"
    date_val="${DATE_ARR[$i]:-}"

    if [[ -z "${date_val}" || "${date_val}" == "on-promotion" ]]; then
        continue
    fi

    epoch="$(date -d "${date_val}" +%s 2>/dev/null || echo "")"
    if [[ -z "${epoch}" ]]; then
        echo "ERROR: entry '${id}' has an unparseable publishedAt: '${date_val}'"
        echo ""
        FAILURES=1
        continue
    fi

    if [[ -n "${PREV_EPOCH}" ]] && ((epoch > PREV_EPOCH)); then
        echo "ERROR: catalog is not declared newest-first."
        echo "  '${id}' (publishedAt: ${date_val}) is dated LATER than the"
        echo "  entry declared just before it, '${PREV_ID}'. Always insert new"
        echo "  entries at the top of the array."
        echo ""
        FAILURES=1
    fi

    PREV_EPOCH="${epoch}"
    PREV_ID="${id}"
done

if [[ "${FAILURES}" -ne 0 ]]; then
    echo "FAILED: What's New catalog integrity check."
    exit 1
fi

echo "  OK - no duplicate ids, no retired-id reuse, newest-first order holds."
echo ""
echo "All checks passed."
exit 0
