#!/usr/bin/env bash
# GUARD:G8 (HOS-1352 program, built by HOS-1418 / U1.3, AC:U1:5 and AC:U1:6).
#
# WHAT IT PROVES
#   The retired grouping word appears in NO versioned file: neither in a file's
#   CONTENT nor in a file's PATH, case-insensitive, across the whole repository
#   (code, schema, types, tests, docs, specs, comments, file names).
#
# THE WORD IS NEVER WRITTEN HERE
#   The pattern is assembled in parts below, so this script (a versioned file
#   like any other) does not trip itself and needs no exemption.
#
# THE ONE EXEMPTION
#   The PDR, by exact path (PDR_EXEMPT_PATH). Cause: it is the document that
#   records the decision to retire the word (DEC-ARCH-012), so it has to name it
#   to say what was retired. It is exempt by NAME, never by folder: a second file
#   next to it is NOT exempt.
#
# THE ONE LIST: exactly three entries (ALLOWLIST). A path under one of them does
#   not fail:
#     1. packages/db/src/migrations/        the migration history, WITHOUT its
#                                           extras/ subfolder (extras are live,
#                                           re-applied SQL, not history)
#     2. packages/seed/src/data-migrations/ the seed data-migration history
#     3. .specs/HOS-135{2,3,4}-*            the folders of the HOS-1352 program
#   The two histories are immutable records of what already ran in production;
#   rewriting them would change a checksum or a ledger name. A fourth entry is a
#   failure (self-check below), not a convenience.
#
# THE TWO TIME RULES (AC:U1:6) - flipped by editing the two constants, in the
#   commit that the rule is named after:
#   - STEP6_RULE: switched on by the commit of step 6 of the cutover, which takes
#     the two histories out of the list. From then on a build destined for
#     production (HOSPEDA_PRODUCTION_BUILD=1, set by CI under the same condition
#     as the coverage run: push to main, or PR with base main) fails if either
#     history is still in the list. Before that commit the same build passes with
#     the list full: step 3 deploys the histories as they are.
#   - CLOSURE_RULE: switched on by the commit that closes HOS-1352, which takes
#     the third entry out. From then on ANY non-empty list fails.
#   Why an env signal and not `git`: the Coolify Docker build has no `.git`, so
#   it could not run this scan; CI can, and tells the rule whether the build it
#   is guarding is the production one.
#
# WHAT IT DOES NOT PROVE
#   - Untracked files are not scanned (the guard reads what is versioned).
#   - Binary files are skipped for content (`git grep -I`) but not for path.
#   - A word split across lines or built in parts at runtime is invisible.

set -euo pipefail

# --- time rules (AC:U1:6): flip these two constants, nothing else ------------
STEP6_RULE=off
CLOSURE_RULE=off

# --- the single exemption, by exact path --------------------------------------
PDR_EXEMPT_PATH='.specs/HOS-1352-billing-verticals-redesign/docs/00-PDR.md'

# --- the single list: exactly three entries ----------------------------------
# Matched in is_allowed(); entry 1 excludes its extras/ subfolder there.
HISTORY_DB='packages/db/src/migrations/'
HISTORY_SEED='packages/seed/src/data-migrations/'
PROGRAM_SPECS='.specs/HOS-135{2,3,4}-*'
ALLOWLIST=(
    "$HISTORY_DB"
    "$HISTORY_SEED"
    "$PROGRAM_SPECS"
)

word='comm''erce'
violations=0
failures=0

fail() {
    echo "  ERROR: $*"
    failures=$((failures + 1))
}

in_allowlist() {
    local wanted="$1" entry
    for entry in "${ALLOWLIST[@]}"; do
        [[ "$entry" == "$wanted" ]] && return 0
    done
    return 1
}

echo '=== Checking the retired grouping word across the whole repository (GUARD:G8) ==='

# --- self-check: the list is the three entries and nothing else ---------------
for entry in "${ALLOWLIST[@]}"; do
    case "$entry" in
        "$HISTORY_DB" | "$HISTORY_SEED" | "$PROGRAM_SPECS") ;;
        *) fail "allowlist entry '$entry' is not one of the three allowed entries" ;;
    esac
done
if [[ "$STEP6_RULE" == off && "$CLOSURE_RULE" == off && "${#ALLOWLIST[@]}" -ne 3 ]]; then
    fail "the allowlist must hold exactly three entries, found ${#ALLOWLIST[@]}"
fi

# --- time rules ----------------------------------------------------------------
if [[ "$STEP6_RULE" == on && "${HOSPEDA_PRODUCTION_BUILD:-}" == 1 ]]; then
    if in_allowlist "$HISTORY_DB" || in_allowlist "$HISTORY_SEED"; then
        fail 'step-6 rule: a production build may not keep a migration history in the allowlist'
    fi
fi
if [[ "$CLOSURE_RULE" == on && "${#ALLOWLIST[@]}" -gt 0 ]]; then
    fail "closure rule: the allowlist must be empty, found ${#ALLOWLIST[@]} entries"
fi

# --- is a path covered by the allowlist? --------------------------------------
is_allowed() {
    local path="$1"
    if in_allowlist "$HISTORY_DB"; then
        case "$path" in
            packages/db/src/migrations/extras/*) ;;
            packages/db/src/migrations/*) return 0 ;;
        esac
    fi
    if in_allowlist "$HISTORY_SEED"; then
        case "$path" in
            packages/seed/src/data-migrations/*) return 0 ;;
        esac
    fi
    if in_allowlist "$PROGRAM_SPECS"; then
        case "$path" in
            .specs/HOS-1352-* | .specs/HOS-1353-* | .specs/HOS-1354-*) return 0 ;;
        esac
    fi
    return 1
}

report() {
    local kind="$1" path="$2"
    [[ "$path" == "$PDR_EXEMPT_PATH" ]] && return 0
    is_allowed "$path" && return 0
    echo "  ERROR: $path ($kind)"
    violations=$((violations + 1))
}

# --- content: every versioned text file, case-insensitive ----------------------
while IFS= read -r -d '' file; do
    report content "$file"
done < <(git grep -Iil -z -e "$word" 2>/dev/null || true)

# --- paths: every versioned file name -------------------------------------------
while IFS= read -r -d '' file; do
    if [[ "${file,,}" == *"$word"* ]]; then
        report path "$file"
    fi
done < <(git ls-files -z)

if [[ "$failures" -gt 0 || "$violations" -gt 0 ]]; then
    echo "ERROR: $violations offending file(s), $failures rule failure(s)."
    exit 1
fi
echo 'All checks passed.'
exit 0
