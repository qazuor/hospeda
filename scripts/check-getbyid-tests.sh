#!/usr/bin/env bash
# check-getbyid-tests.sh
#
# SPEC-083 — guard that service `getById.test.ts` tests assert on the
# correct model method with the correct shape:
#
#   1. No test may use `expect.any(Object)` inside a
#      `toHaveBeenCalledWith` chain — the relation config MUST be exact
#      so an accidental change to `getDefaultListRelations()` /
#      `getDefaultGetByIdRelations()` makes the test fail loudly
#      (closes GAP-022).
#
#   2. Every test file must contain an assertion on
#      `findOne(...) ... toHaveBeenCalledWith` OR
#      `findOneWithRelations(...) ... toHaveBeenCalledWith` — i.e. the
#      tested code path is verified, not just the result. This prevents
#      a regression where the test mocks a method that the service does
#      not actually call (closes GAP-028).
#
#   3. Every test file must contain a `not.toHaveBeenCalled` assertion
#      so the OTHER read method is explicitly verified as not invoked.
#      This forces the test to pin the exact path.
#
# To resolve a CI failure: read the spec at .qtm/specs/SPEC-083 (or
# the project history) for the canonical pattern, then update the test
# to either mock+assert `findOne` (for services WITHOUT relations) or
# mock+assert `findOneWithRelations` with the explicit relation config
# (for services WITH relations).

set -eu

TESTS_DIR="packages/service-core/test/services"
FAIL=0

if [[ ! -d "$TESTS_DIR" ]]; then
    echo "Skipped — $TESTS_DIR not found."
    exit 0
fi

while IFS= read -r f; do
    file_failures=()

    # Check 1: no `expect.any(Object)` inside a toHaveBeenCalledWith chain.
    # Allow `expect.any(Object)` elsewhere (rare, but possible). We grep
    # for the specific anti-pattern.
    if grep -nE 'expect\.any\(Object\)' "$f" >/dev/null 2>&1; then
        # Be precise — only fail if it appears in a toHaveBeenCalledWith
        # call. Many tests legitimately use other expect.any() forms.
        if awk '
            /toHaveBeenCalledWith/ { in_block = 1 }
            in_block && /expect\.any\(Object\)/ { found = 1 }
            in_block && /\)\s*;/ { in_block = 0 }
            END { exit found ? 0 : 1 }
        ' "$f"; then
            file_failures+=("uses expect.any(Object) inside a toHaveBeenCalledWith chain")
        fi
    fi

    # Check 2: must assert on findOne OR findOneWithRelations
    if ! grep -qE '\.findOne[^W]?\)\.toHaveBeenCalledWith|\.findOneWithRelations\)\.toHaveBeenCalledWith' "$f"; then
        file_failures+=("missing toHaveBeenCalledWith assertion on findOne or findOneWithRelations")
    fi

    # Check 3: must include a not.toHaveBeenCalled to pin the path
    if ! grep -q 'not\.toHaveBeenCalled' "$f"; then
        file_failures+=("missing not.toHaveBeenCalled assertion (the other read method must be pinned as unused)")
    fi

    if [[ ${#file_failures[@]} -gt 0 ]]; then
        echo "FAIL $f"
        for issue in "${file_failures[@]}"; do
            echo "    - $issue"
        done
        FAIL=1
    fi
done < <(find "$TESTS_DIR" -name "getById.test.ts" 2>/dev/null)

if [[ $FAIL -eq 1 ]]; then
    echo ""
    echo "FAIL: one or more service getById tests do not follow the SPEC-083"
    echo "exact-match pattern. See header comment of this script for guidance."
    exit 1
fi

echo "OK — all service getById tests use exact-match assertions."
exit 0
