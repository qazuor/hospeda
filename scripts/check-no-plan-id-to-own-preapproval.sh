#!/usr/bin/env bash
# =============================================================================
# check-no-plan-id-to-own-preapproval.sh
#
# HOS-1221, guard G-2.
#
# -----------------------------------------------------------------------------
# THE PROVEN CASE
# -----------------------------------------------------------------------------
#   A `POST /preapproval` that carries `preapproval_plan_id` is MercadoPago's
#   "subscription WITH an associated plan" flow, and MercadoPago documents that
#   flow as requiring `card_token_id` plus `status: 'authorized'`. Hospeda's
#   self-serve checkout never tokenizes a card, so MercadoPago answers:
#
#       "Create subscription - card_token_id is required"
#
#   HOS-191 already learned this once and moved all four checkouts to the hosted
#   share link (Path C) because of it. HOS-937's own-preapproval flow then
#   shipped passing the resolved MP plan as `providerPriceId` — the field
#   qzpay-core forwards to the adapter, which turns it into `preapproval_plan_id`
#   and returns early with no inline `auto_recurring` at all. That rebuilt the
#   exact request shape HOS-191 had retired, and EVERY checkout with
#   `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED=true` answered HTTP 500.
#
#   The correct request is "subscription with NO associated plan": no
#   `preapproval_plan_id`, inline `auto_recurring` built from the resolved
#   price. The plan id is still resolved and still recorded on the row (the
#   §6.6-B reuse check and the retry recovery read it back as the priced-variant
#   key) — it just must not travel in the body.
#
# -----------------------------------------------------------------------------
# WHAT IT PROVES
# -----------------------------------------------------------------------------
#   RULE A (the direct route). The set of production files that put
#   `providerPriceId` in an OBJECT-LITERAL POSITION is EXACTLY the declared
#   inventory below. A new file trips it. A listed file that stops matching also
#   trips it, so an allowance cannot outlive its reason — an inventory that is
#   only checked in one direction rots into a permanent escape hatch.
#
#   RULE B (the indirect route, the one that gets forgotten). qzpay-core
#   resolves the provider plan as:
#
#       input.providerPriceId ?? price.providerPriceIds?.[provider]
#
#   (`@qazuor/qzpay-core`, billing.ts). `providerPriceIds` is hydrated from
#   `billing_prices.mp_price_id`. So populating that column re-enables the
#   plan-based branch by itself, with no code change anywhere near a checkout
#   and no error until MercadoPago answers 400 again. Measured on staging
#   2026-09-07: 0 of 23 rows carry a value, which is the only reason the column
#   is inert today. This rule freezes that zero — no production source may write
#   `mp_price_id` / `mpPriceId` / `providerPriceIds`, and no migration other
#   than the baseline that CREATEs the column may name it.
#
# -----------------------------------------------------------------------------
# WHAT IT IS ANCHORED ON, AND WHY NOT ON A NAME
# -----------------------------------------------------------------------------
#   No function name appears in any regex. `createOwnPreapprovalSubscription`,
#   `createPaidSubscription` and `subscriptions.create` can all be renamed
#   without blinding this guard — and a guard anchored on a symbol name exits 0
#   over a tree where its subject no longer exists, so the PR that renames never
#   sees it fail. This repo has been bitten by exactly that.
#
#   The two anchors are:
#
#   1. WHICH FILES ARE SCANNED is DERIVED, not listed, from TWO computed sets:
#      (a) files importing `@qazuor/qzpay-*`, the only way Hospeda code reaches
#          MercadoPago (same derivation as G-1, check-no-trial-to-mercadopago.sh);
#      (b) files that RECORD a plan id — they name `mpPreapprovalPlanId` in an
#          object-literal position. (b) exists because the one chokepoint every
#          checkout funnels through, the own-preapproval creator, imports no
#          qzpay symbol at all: it wraps the helper that does. Without (b) a
#          plan id reintroduced inside that file would be invisible.
#      A moved or renamed file stays in scope under both; a brand-new checkout
#      is scanned the moment it imports qzpay or records a plan.
#   2. WHAT IS MATCHED is the OBJECT-LITERAL POSITION — a property key, a
#      shorthand/destructured binding, a quoted key or a typed field. Reading
#      `paidInput.providerPriceId` off an object is a member access, not a
#      payload field being BUILT, and does not match. Every alternation is
#      fenced on both sides, so `providerPriceIdX` and `xProviderPriceId` are
#      not matches.
#
# -----------------------------------------------------------------------------
# WHAT IT DOES NOT PROVE
# -----------------------------------------------------------------------------
#   - It is LINE-BASED and skips lines that OPEN with a comment marker, so prose
#     naming the banned field (including this file and the module docblocks that
#     must explain the ban) stays legal. Code does not.
#   - It skips `.test.ts` / `.spec.ts`. The BEHAVIOURAL half lives in
#     `apps/api/test/services/subscription-checkout-no-trial-to-mercadopago.test.ts`,
#     which captures the real create body for all four verticals and asserts the
#     field's ABSENCE. Neither half subsumes the other: this catches a field
#     added to a path that suite does not exercise; that suite catches a plan id
#     arriving through a spelling these regexes do not know.
#   - Rule B is static. Someone with a psql prompt can still `UPDATE
#     billing_prices SET mp_price_id = ...` on a live database and re-enable the
#     plan branch without touching the repo. Nothing in CI can see that. It is
#     recorded here, in the module docblock of
#     `apps/api/src/services/billing/own-preapproval-subscription-create.ts`,
#     and it is the reason the column is worth leaving empty rather than
#     "harmlessly" backfilled.
#
#   There is deliberately NO per-line escape hatch. The inventory below is the
#   only exemption mechanism, it is version-controlled, and it is checked in
#   both directions.
#
# -----------------------------------------------------------------------------
# THE SIBLING DEFECT THIS GUARD DOES NOT COVER, AND WHY
# -----------------------------------------------------------------------------
#   HOS-1221 D3 is the same shape as RULE A — an implicit inheritance nobody can
#   see in a diff — but for `trialDays`. Omitted, qzpay-core falls back to the
#   resolved price's own value (30 on every owner-*/tourist-* monthly row) and
#   the row is born claiming a month of free days on a card MercadoPago charges
#   on day 1.
#
#   It is NOT guarded here, deliberately. This guard can only assert the
#   PRESENCE of a bad field; D3 is an ABSENCE, and asserting "every create call
#   states trialDays" from bash means extracting call blocks and anchoring on the
#   callee's name — the exact fragility the section above rejects, at FILE
#   granularity, so a fifth branch copy-pasted into an already-compliant file
#   would pass.
#
#   The compiler does it properly instead: `trialDays` is REQUIRED on
#   `CreateOwnPreapprovalSubscriptionInput` (it stays optional one layer down, on
#   `CreatePaidSubscriptionInput`). Every call site is checked, including files
#   this scan's derivation would never reach; a rename cannot blind it; the error
#   lands on the offending call, not the file. `pnpm typecheck` runs in the same
#   CI job set as this script. When it landed, the only thing in the whole repo
#   that stopped compiling was the deliberate negative control in
#   `addon.checkout.recurring-borrowed-trial.test.ts` — which now carries the one
#   documented cast in the repo, because a control has to be able to write the
#   shape the type forbids.
#
# -----------------------------------------------------------------------------
# TESTABILITY / POSITIVE CONTROL
# -----------------------------------------------------------------------------
#   `SCAN_FILES_OVERRIDE` (newline-separated paths) replaces the derived TS file
#   list; `SQL_FILES_OVERRIDE` replaces the migration file list. Both let the
#   guard be pointed at a fixture that REINTRODUCES the defect and observed to
#   exit 1. Mirrors `SCAN_FILES_OVERRIDE` in check-no-trial-to-mercadopago.sh.
#
# Exit codes: 0 = no plan id can reach an own-preapproval create; 1 = one can.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

echo "=== Checking no MercadoPago plan id reaches an own-preapproval create (HOS-1221 G-2) ==="
echo ""

SCAN_ROOTS="apps/api/src apps/admin/src apps/web/src packages/service-core/src packages/billing/src packages/db/src packages/schemas/src packages/seed/src"

# The ONLY way Hospeda code reaches MercadoPago — the derivation that survives
# renames and moves.
QZPAY_IMPORT_PATTERN='@qazuor/qzpay-(core|mercadopago|drizzle|hono)'

# RULE A — the field qzpay forwards to the payment adapter.
DIRECT_ALTERNATION='providerPriceId'
# RULE B — the price-row map and the column behind it, which qzpay falls back to
# when RULE A's field is absent. Longest-first so `providerPriceIds` can never be
# matched as a `providerPriceId` prefix by a non-leftmost-longest engine.
INDIRECT_ALTERNATION='providerPriceIds|mpPriceId|mp_price_id'

# Object-literal positions, each anchored on both sides. Same shapes as G-1:
#   KEY        `providerPriceId:` / `readonly providerPriceId?:`
#   SHORTHAND  `{ providerPriceId }` / `{ providerPriceId,` / a lone `providerPriceId,`
#   QUOTED     `'mp_price_id':` / `"mp_price_id":`
#
# The left fence is a line start or `{` / `,` — deliberately NOT `(`, unlike
# G-1's otherwise identical patterns. `(` would match a typed function
# parameter, `async (providerPriceId: string) => ...`, which is a signature
# receiving a value, not a payload being built; the MercadoPago stub adapter in
# `packages/billing` has exactly that and is not a checkout. Every call on these
# paths passes an options OBJECT, so a plan id being SENT always sits behind a
# line start or a `{` / `,`. The cost is that a positional argument would not be
# seen, and no path here has one.
build_patterns() {
    local alternation="$1"
    KEY_PATTERN="(^|[{,])[[:space:]]*((readonly|public|private|protected)[[:space:]]+)?(${alternation})[[:space:]]*\\??[[:space:]]*:"
    SHORTHAND_PATTERN="(^|[{,])[[:space:]]*(${alternation})[[:space:]]*[,}]"
    QUOTED_PATTERN="['\"](${alternation})['\"][[:space:]]*:"
}

# -----------------------------------------------------------------------------
# RULE A's inventory: the files ALLOWED to build a plan-based preapproval.
# Each line is `path # reason`. Checked in BOTH directions.
# -----------------------------------------------------------------------------
ALLOWED_DIRECT_FILES="apps/api/src/services/billing/paid-subscription-create.ts
apps/api/src/services/addon.checkout.recurring.ts"

allowed_reason() {
    case "$1" in
    apps/api/src/services/billing/paid-subscription-create.ts)
        echo "the shared low-level create helper — it DEFINES and forwards the field; removing it here would take the add-on path with it"
        ;;
    apps/api/src/services/addon.checkout.recurring.ts)
        echo "the recurring add-on BORROWS the owner plan's price row to satisfy qzpay's plan+price requirement, so its own MercadoPago plan is what makes the preapproval charge the add-on's amount. Dropping the plan there would charge the borrowed price — it needs an explicit amount override, not a deletion. NOTE: this path therefore hits the same 400 as HOS-1221 whenever HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED is on."
        ;;
    *) echo "(no reason recorded)" ;;
    esac
}

compute_scan_files() {
    if [[ -n "${SCAN_FILES_OVERRIDE:-}" ]]; then
        printf '%s\n' "${SCAN_FILES_OVERRIDE}"
        return 0
    fi

    local existing_roots=()
    local dir
    for dir in ${SCAN_ROOTS}; do
        [[ -d "${dir}" ]] && existing_roots+=("${dir}")
    done

    if [[ ${#existing_roots[@]} -eq 0 ]]; then
        return 0
    fi

    local direct
    direct="$(grep -rlE --include="*.ts" --include="*.tsx" \
        "${QZPAY_IMPORT_PATTERN}" \
        "${existing_roots[@]}" 2>/dev/null |
        grep -v '\.test\.' |
        grep -v '\.spec\.' || true)"

    if [[ -z "${direct}" ]]; then
        return 0
    fi

    # SECOND DERIVATION: every file that RECORDS the plan id — i.e. names
    # `mpPreapprovalPlanId` in an object-literal position. That is the
    # bookkeeping field HOS-1221 split out of the forwarded one, so a file that
    # handles it is by construction on the own-preapproval path, and a file that
    # both records the plan AND sends it is the defect itself.
    #
    # It exists because the own-preapproval creator — the one chokepoint every
    # checkout funnels through — imports NO qzpay symbol: it wraps the helper
    # that does. A plan id reintroduced inside it would be invisible to the
    # derivation above. Both derivations are computed, not listed; neither names
    # a function.
    local recorders
    recorders="$(grep -rlE --include="*.ts" --include="*.tsx" \
        "(^|[{,])[[:space:]]*(readonly[[:space:]]+)?mpPreapprovalPlanId[[:space:]]*\??[[:space:]]*[:,}]" \
        "${existing_roots[@]}" 2>/dev/null |
        grep -v '\.test\.' |
        grep -v '\.spec\.' || true)"

    printf '%s\n%s\n' "${direct}" "${recorders}" | sed '/^$/d' | sort -u
}

SCAN_FILES="$(compute_scan_files)"

if [[ -z "${SCAN_FILES}" ]]; then
    # An empty scope is a BROKEN guard, not a clean tree — a green run over zero
    # files is the classic silent fail-open.
    echo "ERROR: no in-scope files found." >&2
    echo "  Nothing under [${SCAN_ROOTS}] imports ${QZPAY_IMPORT_PATTERN}." >&2
    echo "  That cannot be right for this repo — the file derivation is broken" >&2
    echo "  (moved source roots? renamed qzpay packages?). Fix it; do not ignore it." >&2
    exit 1
fi

FILE_COUNT="$(printf '%s\n' "${SCAN_FILES}" | grep -c . || true)"
echo "  Scanning ${FILE_COUNT} in-scope production file(s) (import qzpay, or record a plan id)."
echo ""

# -----------------------------------------------------------------------------
# scan_files: prints `file:line:text` for every object-literal match of $1.
# -----------------------------------------------------------------------------
scan_files() {
    build_patterns "$1"
    local file found
    while IFS= read -r file; do
        [[ -z "${file}" ]] && continue
        [[ -f "${file}" ]] || continue
        found="$(grep -nE "${KEY_PATTERN}|${SHORTHAND_PATTERN}|${QUOTED_PATTERN}" "${file}" 2>/dev/null |
            grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' |
            sed "s|^|${file}:|" || true)"
        if [[ -n "${found}" ]]; then
            printf '%s\n' "${found}"
        fi
    done <<<"${SCAN_FILES}"
}

FAILED=0

# ── RULE A ───────────────────────────────────────────────────────────────────
DIRECT_HITS="$(scan_files "${DIRECT_ALTERNATION}" | sed '/^$/d' || true)"
DIRECT_FILES="$(printf '%s\n' "${DIRECT_HITS}" | sed '/^$/d' | cut -d: -f1 | sort -u || true)"
ALLOWED_SORTED="$(printf '%s\n' "${ALLOWED_DIRECT_FILES}" | sed '/^$/d' | sort -u)"

UNLISTED="$(comm -23 <(printf '%s\n' "${DIRECT_FILES}" | sed '/^$/d') <(printf '%s\n' "${ALLOWED_SORTED}") || true)"
STALE="$(comm -13 <(printf '%s\n' "${DIRECT_FILES}" | sed '/^$/d') <(printf '%s\n' "${ALLOWED_SORTED}") || true)"

if [[ -n "${UNLISTED}" ]]; then
    FAILED=1
    echo "ERROR: a MercadoPago plan id is being sent to a preapproval create."
    echo ""
    while IFS= read -r file; do
        [[ -z "${file}" ]] && continue
        printf '%s\n' "${DIRECT_HITS}" | grep "^${file}:" || true
    done <<<"${UNLISTED}"
    echo ""
    echo "  \`providerPriceId\` is the field qzpay-core forwards to the payment"
    echo "  adapter, which turns it into \`preapproval_plan_id\` and returns early"
    echo "  with no inline auto_recurring. MercadoPago answers that request with"
    echo "  HTTP 400 \"Create subscription - card_token_id is required\", because"
    echo "  a self-serve checkout never tokenizes a card. Every checkout behind"
    echo "  HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED answered 500 for this."
    echo ""
    echo "  If you need to RECORD which plan variant the checkout was priced"
    echo "  against, pass \`mpPreapprovalPlanId\` instead — it lands on the row's"
    echo "  metadata and is never sent to MercadoPago."
    echo ""
fi

if [[ -n "${STALE}" ]]; then
    FAILED=1
    echo "ERROR: this guard's inventory is stale."
    echo ""
    printf '%s\n' "${STALE}"
    echo ""
    echo "  The file(s) above are listed as ALLOWED to send a plan id, but no"
    echo "  longer do. An allowance that outlives its reason is an escape hatch"
    echo "  nobody is watching. Remove the entry from ALLOWED_DIRECT_FILES."
    echo ""
fi

if [[ ${FAILED} -eq 0 ]]; then
    echo "  OK - the only files sending a plan id are the declared ones:"
    while IFS= read -r file; do
        [[ -z "${file}" ]] && continue
        echo "       - ${file}"
        echo "         $(allowed_reason "${file}")"
    done <<<"${ALLOWED_SORTED}"
    echo ""
fi

# ── RULE B ───────────────────────────────────────────────────────────────────
INDIRECT_HITS="$(scan_files "${INDIRECT_ALTERNATION}" | sed '/^$/d' || true)"

if [[ -n "${INDIRECT_HITS}" ]]; then
    FAILED=1
    echo "ERROR: the INDIRECT route back to a plan-based preapproval is being opened."
    echo ""
    echo "${INDIRECT_HITS}"
    echo ""
    echo "  qzpay-core resolves the provider plan as"
    echo "    input.providerPriceId ?? price.providerPriceIds?.[provider]"
    echo "  and \`providerPriceIds\` is hydrated from billing_prices.mp_price_id."
    echo "  Writing that column re-enables the plan branch on its own, with no"
    echo "  code change near any checkout and no error until MercadoPago answers"
    echo "  400 again. It holds no values today (0 of 23 rows, staging"
    echo "  2026-09-07) and that is what keeps it inert."
    echo ""
fi

# SQL half of RULE B: only the baseline migration may name the column.
compute_sql_files() {
    if [[ -n "${SQL_FILES_OVERRIDE:-}" ]]; then
        printf '%s\n' "${SQL_FILES_OVERRIDE}"
        return 0
    fi
    [[ -d packages/db/src/migrations ]] || return 0
    grep -rlE --include="*.sql" 'mp_price_id' packages/db/src/migrations 2>/dev/null | sort -u || true
}

SQL_HITS="$(compute_sql_files | sed '/^$/d' | grep -v '^packages/db/src/migrations/0000_baseline\.sql$' || true)"

if [[ -n "${SQL_HITS}" ]]; then
    FAILED=1
    echo "ERROR: a migration names billing_prices.mp_price_id."
    echo ""
    printf '%s\n' "${SQL_HITS}"
    echo ""
    echo "  Only the baseline migration, which CREATEs the column, may mention"
    echo "  it. Backfilling it is not a data cleanup: it silently re-enables the"
    echo "  plan-based preapproval branch inside qzpay-core (see RULE B above)."
    echo ""
fi

if [[ ${FAILED} -ne 0 ]]; then
    exit 1
fi

echo "  OK - nothing populates the price-row plan map either."
echo ""
echo "All checks passed."
exit 0
