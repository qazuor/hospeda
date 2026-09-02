#!/usr/bin/env bash
# check-no-binary-vertical-ternary.sh
#
# HOS-1079 — eleven sites across apps/api decided a commerce vertical with a
# binary ternary: `x === 'gastronomy' ? A : B`. `ProductDomainEnum` has FOUR
# members (accommodation, gastronomy, experience, partner); every one of
# those eleven silently answered `B` — `ProductDomainEnum.EXPERIENCE`,
# `experienceService`, `experienceModel`, … — for ANY value that was not the
# literal string 'gastronomy', including 'accommodation' and 'partner'. None
# of the eleven raised.
#
# HOS-1079's fix replaced every one of them with either the shared,
# exhaustive `commerceVerticalToProductDomain` / `parseCommerceVertical`
# helpers (`@repo/billing`, `packages/billing/src/config/commerce-limits.config.ts`)
# or a local `switch` whose `default` branch fails loudly instead of
# defaulting.
#
# WHAT IT PROVES
#   No line of production TypeScript in apps/api/src compares an identifier
#   to the literal 'gastronomy' with an immediately-following ternary `?` —
#   the exact shape every one of the eleven sites had. A `switch`/`case`, or
#   an `if`/`else if` chain, is unaffected; only the direct
#   `=== 'gastronomy' ? … : …` shape is forbidden.
#
# WHAT IT DOES NOT PROVE — stated so a green run is not read as more than it is
#   - It is a whole-file scan (grep -Pzo, not line-based) so it tolerates
#     whitespace and newlines between the comparison and the `?` — exactly the
#     multi-line shape most of the eleven sites had — but it bounds that gap
#     to 200 characters so it cannot match two unrelated pieces of code that
#     both happen to mention 'gastronomy' far apart in the same file.
#   - It only anchors on the literal 'gastronomy'. A rewrite that instead
#     keys the SAME binary ternary off 'experience' (`x === 'experience' ? A
#     : B`) is invisible to it — every existing site (and the shared
#     vocabulary this guard points fixes toward) spells the comparison with
#     'gastronomy', so that is the shape being defended against, not the
#     general concept of a binary ternary.
#   - `.test.ts` / `.spec.ts` files are excluded — test fixtures legitimately
#     assert against literal strings and mock data.
#   - It does not run against apps/web or apps/admin. The eleven sites this
#     guard was written for are all apps/api server-side domain logic;
#     widen SCAN_DIR if a matching pattern turns up elsewhere.

set -euo pipefail

echo "=== Checking for binary vertical ternaries (HOS-1079) ==="
echo ""

SCAN_DIR="apps/api/src"
PATTERN="===\s*['\"]gastronomy['\"][\s\S]{0,200}?\?"

MATCHES=""
while IFS= read -r -d '' file; do
    if grep -Pzo "$PATTERN" "$file" >/dev/null 2>&1; then
        MATCHES="${MATCHES}${file}"$'\n'
    fi
done < <(find "$SCAN_DIR" -type f \( -name '*.ts' -o -name '*.tsx' \) \
    ! -name '*.test.ts' ! -name '*.spec.ts' -print0)

MATCHES=$(echo "$MATCHES" | sed '/^$/d')

if [ -n "$MATCHES" ]; then
    echo "ERROR: found a binary '=== <literal>' ? ... : ... ternary keyed on 'gastronomy'."
    echo ""
    echo "$MATCHES"
    echo ""
    echo "  A ternary of the shape \`x === 'gastronomy' ? A : B\` silently answers"
    echo "  B for EVERY other value — 'accommodation' and 'partner' included"
    echo "  (HOS-1079). Replace it with:"
    echo "    - a product domain      -> commerceVerticalToProductDomain() / parseCommerceVertical() (@repo/billing)"
    echo "    - a model/service/table -> a local exhaustive switch with a defensive default"
    exit 1
fi

echo "  OK - no binary vertical ternary found in $SCAN_DIR."
echo ""
echo "All checks passed."
exit 0
