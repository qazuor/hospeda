#!/usr/bin/env bash
# check-unlisted-plan-filter.sh
#
# HOS-1062 F1 / AC-14 — no plan-listing endpoint may enumerate a plan marked as
# unlisted. There are TWO such endpoints, and this guard watches both.
#
# WHY IT MATTERS
#   `GET /api/v1/public/plans` is `skipAuth: true` and answers with full prices.
#   `GET /api/v1/protected/plans` answers ANY authenticated user — an ordinary
#   tourist account included — with the same prices and raw `metadata`. A
#   negotiated plan (a municipality's agreement, a partner's exclusive price)
#   that reaches either one publishes that agreement. Nothing reports the
#   failure: the response is well formed, the page renders, no log line is
#   written, and nobody opens a ticket to say they saw a price they were not
#   meant to. The defence is a filter in each handler, which is exactly the kind
#   of line a refactor removes without anyone noticing.
#
#   Watching only one of the two doors would be worse than watching neither: it
#   would report as covered what is not.
#
# WHAT IT CHECKS, and which kind each one is
#   A check that asserts "the safe form is present" can be walked around by
#   adding a second, unsafe path beside it — three of these were, and each is
#   now paired with a FORBID that rejects the shape instead. The kind is stated
#   per check so nobody reads more into a green run than it earns.
#
#   1. [exists] The public handler is still there.
#   2. [present] Its loader still calls the shared predicate.
#   3. [FORBID] Inside the public HANDLER, every `return` is `[]` or names the
#      filtered array. This replaces a check that looked for a specific raw
#      expression and was defeated by an alias in one line. It covers the branch
#      a reader forgets: when the DOMAIN query fails, `accommodation` serves an
#      unfiltered-BY-DOMAIN list on purpose (HOS-685), and the visibility mark
#      must still hold there.
#   3b.[FORBID] The public loader never returns its raw accumulator.
#   4. [present] The predicate is still POSITIVE (`=== 'listed'`).
#   4b.[FORBID] ...and is not the negative form. Rewritten as `!== 'unlisted'`
#      it would publish any plan whose mark went missing, which is the difference
#      between "withhold on doubt" and "publish on doubt".
#   5. [FORBID] Nobody reads the mark off raw `metadata` outside the resolver.
#   6. [exists] The protected handler is still there.
#   7. [present] `servablePlans` is defined, with BOTH marks CONJOINED — the
#      whole expression including the `&&`, because swapping it for `||` leaves
#      both names in place and serves everything.
#   7a/7b. [present] Each branch filters: `data: servablePlans(...)` for
#      `?active=true`, `return servablePlans(...)` for the loader the paginated
#      branch reads. Asserted by name rather than by counting call sites, because
#      a count of two is satisfied by one branch calling it twice.
#   8. [FORBID] Every `data:` payload in the protected handler is one of two
#      allowed forms. An allowlist, so a THIRD unfiltered name fails without the
#      check having to predict its spelling.
#   8b.[FORBID] The protected loader never returns its raw accumulator.
#   9. [present] The protected adapter DELEGATES the verdict rather than
#      restating it. No test can cover this one — see the comment at that check.
#
# WHAT IT DOES NOT PROVE — stated so a green run is not read as more than it is
#   - **It covers endpoints that ENUMERATE plans, not single-plan reads.**
#     `GET /api/v1/protected/billing/plans/:id` answers an unlisted plan in full
#     to any authenticated caller, and this guard does not look at it. That is a
#     known, deliberately deferred gap, tracked in its own issue — not something
#     a green run here says anything about.
#   - **AN INTERMEDIATE VARIABLE CROSSES IT.** This is the ceiling of the whole
#     approach and it is not a bug to be fixed by one more regex. Every check
#     here matches SYNTACTIC FORMS, one line at a time, so a value moved through
#     a local first is a different line and a different shape. Measured, against
#     this version:
#
#         const md = row.metadata;
#         return md?.publicListing !== 'unlisted';   // check 5 does not see it
#
#     Chasing each alias is a race this loses, and losing it quietly is worse
#     than not running it: the guard would grow while claiming ground it does
#     not hold. What actually covers that case is the ROUTE TESTS — an aliased
#     re-derivation still has to produce a response, and
#     `listPlans.unlisted-plans.test.ts` / `protected-plans-list.test.ts` assert
#     on the response. Read this guard as protecting the SHAPE of the two
#     handlers, with the tests protecting their BEHAVIOUR. Neither substitutes
#     for the other.
#   - The [present] checks (2, 4, 7, 7a/7b, 9) assert that a required form
#     EXISTS. Each is paired with a forbid where one was possible; where it was
#     not, a second path beside the required form is outside what they see.
#   - It is line-based. A filter call split across lines, or a return built via
#     an intermediate several statements away, is outside what it can see.
#   - It pins ONE spelling of `servablePlans`' predicate. A semantically
#     identical rewrite (two chained `.filter()` calls, say) trips it — a false
#     positive, and the safe direction: the author updates the guard on purpose.
#   - It says nothing about the DATABASE. A plan an operator forgot to mark is a
#     data problem, not a source one.
#   - It says nothing about `pagination.total`, nor about the size of the page
#     either endpoint reads. Those are asserted by the routes' own tests.
#   - It knows about these two endpoints by path. A third listing endpoint would
#     need a line added here; nothing detects one automatically.
#
# TEST INJECTION (used by scripts/__tests__/check-unlisted-plan-filter.test.ts)
#   - HANDLER_FILE_OVERRIDE   — path checked by checks 1-3b instead of the public route.
#   - PREDICATE_FILE_OVERRIDE — path checked by checks 4/4b instead of the schema.
#   - PROTECTED_FILE_OVERRIDE — path checked by checks 6-9 instead of the protected route.
#   - KEY_SCAN_EXTRA_ROOT     — an ADDITIONAL directory for check 5 to scan.
#   Check 5 always scans `apps` and `packages` regardless, so no override run can
#   make it pass by pointing it at an empty tree.
#
# There is deliberately NO ignore comment. An exception would mean a response
# really is wanted for an unlisted plan, which is the thing forbidden.

set -euo pipefail

echo "=== Checking unlisted plans cannot reach any plan listing (HOS-1062 AC-14) ==="
echo ""

HANDLER="${HANDLER_FILE_OVERRIDE:-apps/api/src/routes/billing/public/listPlans.ts}"
PREDICATE="${PREDICATE_FILE_OVERRIDE:-packages/schemas/src/api/billing/billing-plan.schema.ts}"
PROTECTED="${PROTECTED_FILE_OVERRIDE:-apps/api/src/routes/billing/protected-plans-list.ts}"
KEY_DEFINITION_FILE='packages/schemas/src/api/billing/billing-plan.schema.ts'

FAILED=0

# --- Helper: a function's body, with comment lines removed -------------------
#
# Every check that greps a WHOLE FILE for an expression is satisfied by that
# expression sitting in a comment. That is not hypothetical: the predicate
# checks below and the delegation check (9) were each disarmed by rewriting the
# real function to `return true;` and leaving a decoy line naming the very text
# the guard looks for. Both mutations printed "All checks passed", exit 0 — with
# the public catalogue and the protected /plans endpoint serving every withheld
# plan.
#
# So the anchored checks read a function's BODY and nothing else, and strip
# comment lines from it before matching. A decoy now has nowhere to sit: inside
# the function it is stripped, outside the function it is not read.
#
# $1 = file, $2 = regex matching the function's opening line.
# The slice runs to the first line that is exactly `}` at column 0, which is how
# every function in these files closes.
#
# The trailing `|| true` is load-bearing under `set -euo pipefail`: when the
# function is absent the awk slice is empty, `grep -v` then exits 1 on no match,
# and pipefail kills the whole script mid-run — every check after this point
# silently never executes. That is strictly worse than the hole it was added to
# close, and it is what scripts/__tests__/check-unlisted-plan-filter.test.ts
# caught: one fixture lacks isPubliclyListedStoragePlan, and the guard died
# there instead of reporting the two errors the fixture was built to trigger.
# Empty output is a legitimate answer here — the caller checks for it.
function_body_code() {
    awk -v pat="$2" '$0 ~ pat {inside=1} inside {print} inside && /^\}$/ {exit}' "$1" \
        | grep -v -E '^[[:space:]]*(//|\*|/\*)' \
        || true
}

# --- 1. The handler still exists --------------------------------------------
if [ ! -f "$HANDLER" ]; then
    echo "ERROR: $HANDLER is missing."
    echo "  The public plans handler is where the unlisted-plan filter lives. If the"
    echo "  route moved, move this guard with it — do not delete it."
    exit 1
fi

if [ ! -f "$PREDICATE" ]; then
    echo "ERROR: $PREDICATE is missing."
    echo "  isPubliclyListedPlan is the single site that decides what the public sees."
    exit 1
fi

if [ ! -f "$PROTECTED" ]; then
    echo "ERROR: $PROTECTED is missing."
    echo "  The protected /plans override is the SECOND door. Without it, qzpay-hono's"
    echo "  prebuilt GET /plans answers every storage plan to any authenticated user."
    exit 1
fi

echo "  Public handler:    $HANDLER"
echo "  Protected handler: $PROTECTED"
echo "  Predicate:         $PREDICATE"
echo ""

# --- 2. The public loader filters the catalogue it collects ------------------
# Anchored on the exact call. A rename of the predicate trips this check rather
# than sliding past it, which is the safe direction: the author is forced to
# update the guard deliberately.
if ! grep -qE '\.filter\(isPubliclyListedPlan\)' "$HANDLER"; then
    echo "ERROR: the public plans handler no longer filters unlisted plans."
    echo ""
    echo "  Expected a call of the form:"
    echo "      return collected.filter(isPubliclyListedPlan);"
    echo ""
    echo "  Without it every ACTIVE plan is public, including a negotiated one. That"
    echo "  failure is silent: the endpoint answers 200 with a correct-looking body."
    echo ""
    FAILED=1
fi

# --- 3. Every return in the public HANDLER answers the filtered array --------
# This one is a FORBID, not a presence test, and it replaces a check that was
# not. The old form looked for `return ... result.data.items`, which an alias
# defeated in one line — `const allPlans = result.data.items; return allPlans;`
# left the filter in place higher up and shipped the leak with the guard green
# (verified by the reviewer, tests red / guard green).
#
# The rule instead: inside the handler, a return may answer `[]` or something
# that names the filtered array, and NOTHING ELSE. Any new name — an alias, a
# second service call, a re-fetch — fails it by construction.
#
# The handler is sliced by its own two anchors. If either moves the slice comes
# back empty and the check fails LOUDLY rather than passing over nothing.
HANDLER_BODY=$(awk '/handler: async/{inside=1} inside{print} inside && /^    options: \{/{exit}' "$HANDLER")

if [ -z "$HANDLER_BODY" ]; then
    echo "ERROR: could not locate the public handler body in $HANDLER."
    echo "  This check slices from 'handler: async' to the 'options: {' line. One of"
    echo "  those anchors moved — re-anchor it rather than deleting the check, which"
    echo "  would leave every return in the handler unwatched."
    echo ""
    FAILED=1
else
    # `publiclyListedPlans` is matched as a WHOLE identifier. A plain substring
    # filter let `publiclyListedPlansUnfiltered` through, which is a different
    # variable holding a different thing and reads almost identically in review.
    # (`\b` alone does not help here: there is no word boundary between `s` and
    # `U`, so a trailing-suffix name has to be excluded by the character class.)
    UNFILTERED_RETURNS=$(printf '%s\n' "$HANDLER_BODY" \
        | grep -nE '^[[:space:]]*return[[:space:]]' \
        | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' \
        | grep -vE 'return[[:space:]]*\[\][[:space:]]*;' \
        | grep -vE '(^|[^A-Za-z0-9_$])publiclyListedPlans([^A-Za-z0-9_$]|$)' \
        || true)

    if [ -n "$UNFILTERED_RETURNS" ]; then
        echo "ERROR: a return in the public plans handler does not answer the filtered array:"
        echo ""
        echo "$UNFILTERED_RETURNS"
        echo ""
        echo "  Every return must be '[]' or built from publiclyListedPlans. The DOMAIN"
        echo "  filter fails OPEN for accommodation on purpose (HOS-685); the visibility"
        echo "  mark must fail CLOSED in that same branch, and in every other."
        echo ""
        FAILED=1
    fi
fi

# --- 3c. `publiclyListedPlans` actually COMES FROM the filtering loader ------
# Check 3 proves every return is built from a binding called
# `publiclyListedPlans`; check 3b proves the loader filters. Neither proves the
# two are connected, and that gap is a real escape: point the binding at an
# unfiltered `planService.list({ active: true })`, keep the NAME, and leave
# `loadPubliclyListedPlans` sitting unused below. Both checks stay green and the
# public catalogue serves every withheld plan.
#
# This closes the chain — returns <- publiclyListedPlans <- loadPubliclyListedPlans()
# — so the three checks together assert one fact instead of three adjacent ones.
if ! grep -q -E 'publiclyListedPlans[[:space:]]*=[[:space:]]*await[[:space:]]+loadPubliclyListedPlans\(' "$HANDLER"; then
    echo "ERROR: publiclyListedPlans is not assigned from loadPubliclyListedPlans()."
    echo ""
    echo "  Expected:  const publiclyListedPlans = await loadPubliclyListedPlans();"
    echo ""
    echo "  Check 3 only proves the returns read a binding by that NAME, and check 3b"
    echo "  only proves the loader filters. Without this, the name can be re-pointed"
    echo "  at an unfiltered fetch while the real loader stays behind as dead code."
    echo ""
    FAILED=1
fi

# --- 3b. Every exit of the public LOADER is a filtered one -------------------
# Anchored on the SHAPE of the return, never on the accumulator's name. The
# previous version watched the identifier `collected`, so renaming it to `rows`
# disarmed the check outright (verified: `return rows;` before the filter, guard
# green, five route tests red) — and `\bcollected\b` did not even match
# `collected2`, since there is no word boundary between `d` and `2`.
#
# Three shapes are allowed inside the loader, and nothing else:
#   - `return null;`                  the catalogue could not be read
#   - anything `.filter(isPubliclyListedPlan)`   the filtered catalogue
#   - `return { items: ... }`         one PAGE handed back to the collector
# A rename now changes nothing; `return rows;` fails whatever `rows` is called.
#
# The end anchor is `^}$` — a line that is NOTHING but a closing brace. `^}` was
# not enough: a multi-line signature ends on `}): Promise<...> {`, which also
# starts with `}`, so the slice stopped at the signature and never saw the body.
# It was still non-empty, so the emptiness check below did not fire and a
# `return rows;` in the body went unseen. Requiring a `return` in the slice is
# what makes that failure impossible rather than merely unlikely.
LOADER_BODY=$(awk '/^async function loadPubliclyListedPlans/{inside=1} inside{print} inside && /^\}$/ && NR>1{exit}' "$HANDLER")

if ! printf '%s\n' "$LOADER_BODY" | grep -qE '^[[:space:]]*return[[:space:]]'; then
    echo "ERROR: could not read the public catalogue loader's body in $HANDLER."
    echo "  This check slices 'async function loadPubliclyListedPlans' to its closing"
    echo "  brace and expects at least one return inside. It found none, so either the"
    echo "  loader moved or the slice is cutting short — re-anchor it rather than"
    echo "  dropping it, since without the slice every exit of the loader is unwatched."
    echo ""
    FAILED=1
else
    PUBLIC_RAW_RETURNS=$(printf '%s\n' "$LOADER_BODY" \
        | grep -nE '^[[:space:]]*return[[:space:]]' \
        | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' \
        | grep -vE 'return[[:space:]]*null[[:space:]]*;' \
        | grep -v '.filter(isPubliclyListedPlan)' \
        | grep -vE 'return[[:space:]]*\{[[:space:]]*items:' \
        || true)

    if [ -n "$PUBLIC_RAW_RETURNS" ]; then
        echo "ERROR: an exit of the public catalogue loader is not filtered:"
        echo ""
        echo "$PUBLIC_RAW_RETURNS"
        echo ""
        echo "  Allowed: 'return null;', '<rows>.filter(isPubliclyListedPlan)', or a"
        echo "  '{ items: ... }' page handed back to the collector. Anything else is a"
        echo "  raw catalogue leaving the one function that is supposed to filter it."
        echo ""
        FAILED=1
    fi
fi

# --- 4. The predicate is still a positive test -------------------------------
# Read from the FUNCTION'S BODY, not the file: a whole-file grep here passed with
# the function rewritten to `return true;` and the expected text left behind in a
# comment. See `function_body_code` above.
PREDICATE_BODY=$(function_body_code "$PREDICATE" 'function isPubliclyListedPlan')

if [ -z "$PREDICATE_BODY" ]; then
    echo "ERROR: could not read isPubliclyListedPlan's body in $PREDICATE."
    echo "  This check slices 'function isPubliclyListedPlan' to its closing brace."
    echo "  If the function was renamed or reshaped, re-anchor this guard — do not"
    echo "  drop it."
    echo ""
    FAILED=1
fi

if ! printf '%s\n' "$PREDICATE_BODY" | grep -q -E "publicListing === 'listed'"; then
    echo "ERROR: isPubliclyListedPlan is no longer a positive test for 'listed'."
    echo ""
    echo "  Expected: return plan.publicListing === 'listed';"
    echo ""
    echo "  A negative test ( !== 'unlisted' ) publishes any plan whose mark went"
    echo "  missing — a mapper that dropped the field, a payload from an older"
    echo "  service. Withhold on doubt, never publish on doubt."
    echo ""
    FAILED=1
fi

if printf '%s\n' "$PREDICATE_BODY" | grep -q -E "publicListing !== 'unlisted'"; then
    echo "ERROR: isPubliclyListedPlan tests the mark negatively ( !== 'unlisted' )."
    echo "  See above: that inverts the failure direction."
    echo ""
    FAILED=1
fi

# The body must not answer a constant. `return true;` publishes every plan and
# `return false;` publishes none; both are one keystroke from the real predicate
# and neither trips the two checks above once a decoy comment is present.
if printf '%s\n' "$PREDICATE_BODY" | grep -q -E '^[[:space:]]*return[[:space:]]+(true|false)[[:space:]]*;'; then
    echo "ERROR: isPubliclyListedPlan answers a constant."
    echo ""
    echo "  A predicate that ignores its argument is not a filter. 'return true'"
    echo "  hands every withheld plan to the public catalogue."
    echo ""
    FAILED=1
fi

# --- 5. Nobody reads the mark off `metadata` by hand -------------------------
# Everyone must reach it through the resolver, so the fail-closed reading of an
# unreadable mark cannot be bypassed.
#
# The first version of this check required QUOTES around the key
# (`['"]publicListing['"]`), which is not how anybody writes a property read.
# The reviewer put this in production and the guard printed "OK - the metadata
# key has one production site" with two:
#
#     return row.metadata?.publicListing !== "unlisted";
#
# That is precisely the negative comparison checks 4/4b exist to forbid, walking
# in through the side door. The pattern now matches the RECEIVER — a read off
# something called `metadata` — in all three spellings, plus the bare quoted
# literal (an object built by hand, or bracket access on any receiver).
#
# What it deliberately does NOT match: `plan.publicListing`, `record.publicListing`
# and the field declaration itself. The mark travels ON the DTO by design, so the
# field name is spelled legitimately in the mapper, in the admin types and in the
# admin table. The dangerous act is reading it out of raw `metadata`, not naming it.
#
# What it does not match and SHOULD, but cannot: the same read through a local.
# `const md = row.metadata; return md?.publicListing !== 'unlisted';` passes —
# measured. See the intermediate-variable note in WHAT IT DOES NOT PROVE; the
# behaviour of an aliased re-derivation is covered by the route tests, not here.
#
# Reported with line numbers rather than as a file list, because the docblocks
# that EXPLAIN the mark have to name `metadata.publicListing` in prose — the
# mapper's and the protected handler's both do. A guard that flagged those would
# be a guard somebody turns off, so comment lines are dropped.
#
# `KEY_SCAN_EXTRA_ROOT` ADDS a directory to the scan; it never replaces `apps`
# and `packages`. The positive control needs somewhere to put a probe, and the
# property that matters — a green run cannot mean "it looked at nothing" —
# survives, because the repository is scanned either way.
KEY_SITES=$(grep -rnE --include="*.ts" --include="*.tsx" --include="*.astro" \
    "(metadata[[:space:]]*\??\.[[:space:]]*publicListing|metadata[[:space:]]*\??\[[[:space:]]*['\"]publicListing['\"]|['\"]publicListing['\"])" \
    apps packages ${KEY_SCAN_EXTRA_ROOT:+"$KEY_SCAN_EXTRA_ROOT"} 2>/dev/null \
    | grep -v '/node_modules/' \
    | grep -v '/dist/' \
    | grep -v '\.test\.' \
    | grep -v '\.spec\.' \
    | grep -vE "^${KEY_DEFINITION_FILE}:" \
    | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' \
    || true)

if [ -n "$KEY_SITES" ]; then
    echo "ERROR: the 'publicListing' mark is read off metadata outside its definition:"
    echo ""
    echo "$KEY_SITES"
    echo ""
    echo "  Use resolvePlanPublicListing({ metadata }) — it is the ONE reader, and the"
    echo "  one that withholds a plan whose mark is present but unreadable. A hand-"
    echo "  written comparison skips that and publishes on doubt."
    echo ""
    FAILED=1
fi

# --- 6/7. The protected handler filters on BOTH branches ---------------------
# `servablePlans` is the one function both branches call. It must apply both
# marks, and it must be called at least twice — once per branch.
if ! grep -qE 'function servablePlans' "$PROTECTED"; then
    echo "ERROR: the protected plans handler no longer defines servablePlans()."
    echo ""
    echo "  It is the single function both branches filter through. Without it the"
    echo "  ?active=true branch and the paginated one drift apart, which is how a"
    echo "  mark ends up applied to one door and not the other."
    echo ""
    FAILED=1
else
    # The WHOLE expression, operator included. Looking for the two names
    # separately let `&&` become `||` with both texts still present — a one-
    # character edit that serves every test plan AND every unlisted plan while
    # the guard stayed green (found by adversarial review, by reading).
    if ! grep -qE '!isTestPlan\(plan\)[[:space:]]*&&[[:space:]]*isPubliclyListedStoragePlan\(plan\)' "$PROTECTED"; then
        echo "ERROR: servablePlans() no longer applies both marks, conjoined."
        echo ""
        echo "  Expected exactly:"
        echo "      !isTestPlan(plan) && isPubliclyListedStoragePlan(plan)"
        echo ""
        echo "  With '||' instead of '&&' a plan needs to satisfy only ONE of the two"
        echo "  to be served, which is every plan. Both names being present is not"
        echo "  enough — the operator between them is the whole filter."
        echo ""
        FAILED=1
    fi
fi

# Each branch is asserted by NAME rather than by counting call sites: a count of
# two is satisfied by one branch calling it twice, which is exactly the state
# this check exists to reject.
if ! grep -qE 'data:[[:space:]]*servablePlans\(' "$PROTECTED"; then
    echo "ERROR: the ?active=true branch no longer filters through servablePlans()."
    echo ""
    echo "  Expected:  return c.json({ success: true, data: servablePlans(active) });"
    echo ""
    echo "  This is the branch a consumer reaches for first — no pagination envelope,"
    echo "  the shape most callers use — so an unlisted plan escaping HERE is the"
    echo "  likelier of the two leaks."
    echo ""
    FAILED=1
fi

if ! grep -qE 'return servablePlans\(' "$PROTECTED"; then
    echo "ERROR: the paginated branch's catalogue loader no longer filters."
    echo ""
    echo "  Expected loadServableCatalog() to answer 'return servablePlans(collected);'"
    echo "  — filtering BEFORE the window is applied, so pagination.total counts what"
    echo "  the response carries instead of announcing plans it withholds."
    echo ""
    FAILED=1
fi

# The presence of ONE filtered return is not enough: a second, unfiltered return
# would leave the first in place and green. Measured — an early `return
# collected;` inside the paging loop kept both checks above passing while five
# route tests went red.
#
# Anchored on the SHAPE of the return, not on the accumulator's name, for the
# same reason as check 3b: watching the identifier `collected` was disarmed by
# renaming it. Allowed inside the loader: `servablePlans(...)`, `return null;`,
# and a `{ items: ... }` page handed back to the collector.
PROTECTED_LOADER_BODY=$(awk '/^async function loadServableCatalog/{inside=1} inside{print} inside && /^\}$/ && NR>1{exit}' "$PROTECTED")

if ! printf '%s\n' "$PROTECTED_LOADER_BODY" | grep -qE '^[[:space:]]*return[[:space:]]'; then
    echo "ERROR: could not read the protected catalogue loader's body in $PROTECTED."
    echo "  This check slices 'async function loadServableCatalog' to its closing brace"
    echo "  and expects at least one return inside. It found none — re-anchor it rather"
    echo "  than dropping it."
    echo ""
    FAILED=1
fi

RAW_ACCUMULATOR_RETURNS=$(printf '%s\n' "$PROTECTED_LOADER_BODY" \
    | grep -nE '^[[:space:]]*return[[:space:]]' \
    | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' \
    | grep -vE 'return[[:space:]]*null[[:space:]]*;' \
    | grep -v 'servablePlans(' \
    | grep -vE 'return[[:space:]]*\{[[:space:]]*items:' \
    || true)

# The protected adapter must DELEGATE the verdict, never restate it. A local
# `.publicListing === 'listed'` here would be a second comparison free to drift
# from the shared one — and one that cannot even be tested: the resolver is total
# over two values, so `=== 'listed'` and `!== 'unlisted'` are the same expression
# at this call site. Measured: that mutation survived all 15 route tests.
#
# Read from the FUNCTION'S BODY, for the same reason as check 4: greping the
# whole file passed with `isPubliclyListedStoragePlan` rewritten to
# `return true;` and the expected composition left behind in a comment — the
# protected endpoint then answered every negotiated plan to any authenticated
# user, in a green run.
STORAGE_PREDICATE_BODY=$(function_body_code "$PROTECTED" 'function isPubliclyListedStoragePlan')

if [ -z "$STORAGE_PREDICATE_BODY" ]; then
    echo "ERROR: could not read isPubliclyListedStoragePlan's body in $PROTECTED."
    echo "  This check slices 'function isPubliclyListedStoragePlan' to its closing"
    echo "  brace. Re-anchor it if the adapter was renamed — do not drop it."
    echo ""
    FAILED=1
fi

if ! printf '%s\n' "$STORAGE_PREDICATE_BODY" \
    | grep -q -E 'isPubliclyListedPlan\(resolvePlanPublicListing\('; then
    echo "ERROR: the protected handler no longer delegates the listing verdict."
    echo ""
    echo "  Expected:  isPubliclyListedPlan(resolvePlanPublicListing({ metadata: plan.metadata }))"
    echo ""
    echo "  Restating the comparison here creates a second decision site that no"
    echo "  mutation can catch, because the resolver only ever answers one of two"
    echo "  values. Compose the two shared functions instead."
    echo ""
    FAILED=1
fi

if printf '%s\n' "$STORAGE_PREDICATE_BODY" \
    | grep -q -E '^[[:space:]]*return[[:space:]]+(true|false)[[:space:]]*;'; then
    echo "ERROR: isPubliclyListedStoragePlan answers a constant."
    echo ""
    echo "  'return true' hands every storage plan — negotiated ones included — to"
    echo "  any authenticated user through the protected /plans endpoint."
    echo ""
    FAILED=1
fi

if [ -n "$RAW_ACCUMULATOR_RETURNS" ]; then
    echo "ERROR: an exit of the protected catalogue loader is not filtered:"
    echo ""
    echo "$RAW_ACCUMULATOR_RETURNS"
    echo ""
    echo "  Allowed: 'servablePlans(...)', 'return null;', or a '{ items: ... }' page"
    echo "  handed back to the collector. qzpay's pages carry every storage plan,"
    echo "  negotiated ones included."
    echo ""
    FAILED=1
fi

# --- 8. Every `data:` the protected handler answers is an ALLOWED form -------
# An allowlist, not a deny-list. The deny-list version named the two shapes that
# existed (`data: active`, `data: <x>.data`), which meant a THIRD name — a new
# local holding an unfiltered fetch — walked straight through. Inverting it makes
# any unrecognised payload the failure, so the check does not have to predict the
# next spelling.
#
# `ReadonlyArray` is excluded because `data:` also appears in this file as a TYPE
# annotation (the shape of a qzpay page), which is a declaration, not a payload.
PROTECTED_DATA_PAYLOADS=$(grep -nE '[[:space:]]data:[[:space:]]' "$PROTECTED" \
    | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' \
    | grep -vE 'data:[[:space:]]*(servablePlans\(|servable\.slice\()' \
    | grep -v 'ReadonlyArray' \
    || true)

if [ -n "$PROTECTED_DATA_PAYLOADS" ]; then
    echo "ERROR: the protected plans handler answers a payload that is not filtered:"
    echo ""
    echo "$PROTECTED_DATA_PAYLOADS"
    echo ""
    echo "  Allowed forms, and nothing else:"
    echo "      data: servablePlans(...)        (the ?active=true branch)"
    echo "      data: servable.slice(...)       (the paginated branch)"
    echo ""
    echo "  qzpay returns every storage plan, unfiltered by active or by anything"
    echo "  else. A new name here is a new way to answer one."
    echo ""
    FAILED=1
fi

if [ "$FAILED" -eq 1 ]; then
    exit 1
fi

echo "  OK - the public handler filters unlisted plans on every return path."
echo "  OK - the predicate withholds on doubt."
echo "  OK - the metadata key has one production site."
echo "  OK - the protected handler filters both branches through servablePlans()."
echo ""
echo "All checks passed."
exit 0
