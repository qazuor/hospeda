#!/usr/bin/env bash
# check-commerce-plan-resolution.sh
#
# HOS-688 AC-35 — the vertical → plan-slug resolution happens in exactly ONE
# place, and nothing in the type system says so.
#
# WHY IT MATTERS
#   Commerce billing is per-vertical: gastronomy and experience are DISTINCT
#   MercadoPago preapproval plans, which is what lets an owner who spent their
#   free trial on one still receive one on the other (MP scopes a trial to
#   `(payer, preapproval_plan)`). A second module that resolves a commerce plan
#   slug on its own — by reading the env var, or by hardcoding a slug — quietly
#   reintroduces the single-plan behaviour for whichever call site it owns. Both
#   verticals then bill against one plan, the second trial silently does not
#   happen, and every page still renders perfectly.
#
#   This is not hypothetical: `routes/commerce/admin/start-subscription.ts` read
#   `env.HOSPEDA_COMMERCE_PLAN_ID` inline while `commerce-plan-resolver.ts`
#   existed for exactly that purpose, and HOS-688 had to migrate it.
#
# WHAT IT PROVES
#   1. Only `services/commerce-plan-resolver.ts` reads
#      `HOSPEDA_COMMERCE_PLAN_SLUGS` off `env` (the pure parser in
#      `utils/commerce-plan-config.ts` and the boot validation in
#      `utils/env.ts` / `utils/env-schema.ts` / the `@repo/config` registry are
#      the declared exceptions — they DEFINE, document and validate the
#      variable; none of them resolves a vertical to a slug).
#   2. No production TypeScript outside `@repo/billing`'s catalogue hardcodes a
#      per-vertical commerce plan slug literal.
#
# WHAT COUNTS AS "READS" IN CHECK 1 (HOS-895 PR2 fix)
#   A dotted member access immediately before the name — `env.HOSPEDA_COMMERCE_
#   PLAN_SLUGS`, `data.HOSPEDA_COMMERCE_PLAN_SLUGS`, or any other receiver —
#   which is how every real read of this variable is written in this codebase.
#   A bare mention of the string (a JSDoc line naming the variable, an error
#   message, a "you still need to configure X" note) is NOT a read and no
#   longer trips this check. Before this fix, check 1 matched the string
#   ANYWHERE — including inside comments and string literals — while check 2
#   below already filtered comments; that inconsistency flagged HOS-895 PR2's
#   own documentation (explaining exactly why `gastronomy-pro` is not yet
#   reachable) as if it read the variable, which it does not. The dot-prefix
#   rule fixes the four false positives that produced (two JSDoc mentions, one
#   of them inside a template-string message) without narrowing the allowlist
#   or weakening what a REAL unauthorized read looks like.
#
# WHAT IT DOES NOT PROVE — stated so a green run is not read as more than it is
#   - It is line-based, so a read split across several lines is invisible to it.
#   - Check 1 only recognizes dotted member access. Bracket notation
#     (`env['HOSPEDA_COMMERCE_PLAN_SLUGS']`) or a destructured binding
#     (`const { HOSPEDA_COMMERCE_PLAN_SLUGS } = env`) would read the variable
#     without tripping it — no such access exists in this codebase today, and
#     introducing one is a static-guard gap to close then, not a hypothetical
#     worth complicating this regex for now.
#   - It says nothing about the DATABASE. A plan renamed in `billing_plans`
#     without the config following is a data problem, not a source one.
#   - It does not check that the resolved slug exists. That cannot be known at
#     lint time; it surfaces as `PLAN_NOT_FOUND` from the checkout service.
#
# There is deliberately NO ignore comment. An exception would mean a second
# resolution site really is wanted somewhere, which is the thing being forbidden.

set -euo pipefail

echo "=== Checking commerce plan resolution is single-sited (HOS-688 AC-35) ==="
echo ""

RESOLVER="apps/api/src/services/commerce-plan-resolver.ts"

if [ ! -f "$RESOLVER" ]; then
    echo "ERROR: $RESOLVER is missing — AC-35's single resolution site no longer exists."
    exit 1
fi

FAILED=0

# --- 1. Who reads the configuration -----------------------------------------
# Allowed: the resolver (resolution), the pure parser (definition), and the two
# env modules (declaration + boot validation).
ALLOWED_ENV_READERS='^(apps/api/src/services/commerce-plan-resolver\.ts|apps/api/src/utils/commerce-plan-config\.ts|apps/api/src/utils/env\.ts|apps/api/src/utils/env-schema\.ts|packages/config/src/env-registry\.hospeda\.ts)$'

# Matches a dotted member-access READ (`env.HOSPEDA_COMMERCE_PLAN_SLUGS`,
# `data.HOSPEDA_COMMERCE_PLAN_SLUGS`, any receiver) — see "WHAT COUNTS AS
# READS" above. A bare mention of the name with no `.` immediately before it
# (a JSDoc line, an error message, an object key declaration) does not match.
ENV_READERS=$(grep -rlE --include="*.ts" --include="*.tsx" --include="*.astro" \
    '\.HOSPEDA_COMMERCE_PLAN_SLUGS\b' \
    apps packages 2>/dev/null \
    | grep -v '/node_modules/' \
    | grep -v '/dist/' \
    | grep -v '\.test\.' \
    | grep -v '\.spec\.' \
    | grep -vE "$ALLOWED_ENV_READERS" \
    || true)

if [ -n "$ENV_READERS" ]; then
    echo "ERROR: HOSPEDA_COMMERCE_PLAN_SLUGS is read outside the resolver:"
    echo ""
    echo "$ENV_READERS"
    echo ""
    echo "  Call resolveCommercePlanSlug({ entityType }) instead. It is the ONE"
    echo "  place a commerce vertical becomes a plan slug (AC-35)."
    echo ""
    FAILED=1
fi

# --- 2. Who hardcodes a per-vertical plan slug ------------------------------
# The catalogue itself declares the slugs; everything else must resolve them.
ALLOWED_SLUG_SITES='^(packages/billing/src/config/plans\.config\.ts|packages/seed/src/data-migrations/)'

SLUG_LITERALS=$(grep -rnE --include="*.ts" --include="*.tsx" --include="*.astro" \
    "['\"](gastronomy|experience)-(basico|pro|premium)['\"]" \
    apps packages 2>/dev/null \
    | grep -v '/node_modules/' \
    | grep -v '/dist/' \
    | grep -v '\.test\.' \
    | grep -v '\.spec\.' \
    | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' \
    | grep -vE "$ALLOWED_SLUG_SITES" \
    || true)

if [ -n "$SLUG_LITERALS" ]; then
    echo "ERROR: a commerce plan slug is hardcoded outside the catalogue:"
    echo ""
    echo "$SLUG_LITERALS"
    echo ""
    echo "  Resolve it instead:"
    echo "    - a checkout        -> resolveCommercePlanSlug({ entityType })"
    echo "    - the default map   -> DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL"
    echo ""
    FAILED=1
fi

if [ "$FAILED" -eq 1 ]; then
    exit 1
fi

echo "  OK - the commerce vertical -> plan slug resolution has exactly one site."
echo ""
echo "All checks passed."
exit 0
