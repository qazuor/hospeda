#!/usr/bin/env bash
# =============================================================================
# check-no-trial-to-mercadopago.sh
#
# HOS-1012, guard G-1.
#
# -----------------------------------------------------------------------------
# THE PROVEN CASE
# -----------------------------------------------------------------------------
#   MercadoPago grants a preapproval's free trial ONCE per
#   `(payer, preapproval_plan)`, and reports a trial it has already spent
#   byte-identically to a live one (measured 2026-08-31, HOS-936: two
#   preapprovals for the same payer two seconds apart, same `free_trial`, same
#   `first_invoice_offset`, different `next_payment_date`).
#
#   In production that promised a customer fourteen free days and charged them
#   ARS 18.000 one hundred and eighteen seconds later (HOS-522).
#
#   HOS-1012's answer is not a better reader. It is to stop asking: a trial we
#   never request is a trial MercadoPago cannot lie about. Hospeda's trial is
#   now its own — a local `status='trialing'` row with `mp_subscription_id =
#   NULL`, opened at the owner's first publish, with no card and no provider
#   object behind it. Checkout is the paid path and nothing else.
#
# -----------------------------------------------------------------------------
# WHAT IT PROVES
# -----------------------------------------------------------------------------
#   No production TypeScript file that touches the qzpay / MercadoPago API
#   surface names a free trial in an OBJECT-LITERAL POSITION — as a property
#   key, as a shorthand property, as a destructure, or as a typed field on an
#   interface that feeds one. The banned names, both wire spellings and ours:
#
#       free_trial   freeTrial   freeTrialDays   start_date
#
#   `start_date` is banned alongside `free_trial` because HOS-171 measured that
#   they are the SAME provider mechanism for deferring the first charge.
#   Banning only the field that caused the incident would leave the door open
#   and the next incident would read as a different bug. It is verified against
#   the provider contract: `MercadoPagoPreapproval.auto_recurring.start_date`
#   in `@qazuor/qzpay-mercadopago`'s types, and `freeTrialDays` on qzpay-core's
#   subscription-create input.
#
#   Bare camelCase `startDate` is NOT banned, and the omission is deliberate
#   rather than an oversight. qzpay-core's create input has no such field — a
#   start date only ever reaches MercadoPago as snake_case `start_date` — while
#   `startDate` is a perfectly ordinary date-range filter name that already
#   appears on admin list schemas in scope (`AdminBillingViewQuery.startDate`).
#   Banning it would make this guard cry wolf on the first admin report, and a
#   guard that cries wolf gets a per-line escape hatch bolted on by the third
#   person it inconveniences. That escape hatch is the real failure mode; a
#   ban that is exactly as wide as the provider contract is what avoids it.
#
# -----------------------------------------------------------------------------
# WHAT IT IS ANCHORED ON, AND WHY NOT ON A NAME
# -----------------------------------------------------------------------------
#   The spec is explicit: anchor on the PAYLOAD SHAPE, not on a function name.
#   A guard that greps for `createPaidSubscription` or `subscriptions.create`
#   dies silently at the first rename — and the PR that renames does not see it
#   fail, because the guard still exits 0 over a tree where its subject no
#   longer exists. That has already happened in this repo.
#
#   So there are two anchors here, and neither is a symbol name:
#
#   1. WHICH FILES ARE SCANNED is DERIVED, not listed. A file is in scope iff
#      it imports from `@qazuor/qzpay-*` — the only way any Hospeda code can
#      reach MercadoPago. A renamed function stays in scope. A file moved to a
#      new directory stays in scope. A brand-new checkout path is scanned the
#      moment it imports qzpay, with nobody remembering to add it to a list.
#      (The one thing that escapes is a payload built in a file that imports no
#      qzpay symbol at all and hands the object to a caller that does. See
#      WHAT IT DOES NOT PROVE.)
#
#   2. WHAT IS MATCHED is the OBJECT-LITERAL POSITION, not the bare name. A
#      banned identifier only trips the guard where it is a key (`freeTrialDays:`),
#      a shorthand or destructured binding (`{ freeTrialDays }`, `{ freeTrialDays,`),
#      a typed field (`readonly freeTrialDays?: number`), or a quoted key
#      (`'free_trial':`). Reading a same-named property off something else —
#      `body.free_trial` on a provider payload we are inspecting — is a member
#      access, not a payload field being BUILT, and does not match. (The read
#      direction has its own guard: check-trial-not-derived-from-free-trial.sh,
#      HOS-936. This one is the write direction.)
#
#   EVERY REGEX IS ANCHORED. Another repo precedent: an unanchored guard
#   watching `data-astro-reload` happily let `data-astro-reloadX` through. Here
#   the alternation is fenced on the left by a line start or one of `{ , ( '"`
#   and on the right by `:`, `,`, `}` or `?:` — so `freeTrialDaysX` and
#   `xFreeTrialDays` are not matches, and neither is a longer identifier that
#   merely contains one.
#
# -----------------------------------------------------------------------------
# WHAT IT DOES NOT PROVE
# -----------------------------------------------------------------------------
#   - It is LINE-BASED, and it skips lines that OPEN with a comment marker
#     (`//`, `*`, `/*`) — the same convention as the sibling guards in this
#     directory. Prose about the ban, including this file's own rationale and
#     the module docblocks that must name the fields to explain why they are
#     gone, stays legal. Code does not.
#   - It skips `.test.ts` / `.spec.ts`. A regression proving a field is ABSENT
#     legitimately needs to name it in a fixture, and
#     `apps/api/test/services/subscription-checkout-no-trial-to-mercadopago.test.ts`
#     does exactly that. That suite is the BEHAVIORAL half of this guard: it
#     asserts the built payload over all four verticals. Neither half subsumes
#     the other — this catches a field added to a path the suite does not
#     exercise, the suite catches a trial arriving through a spelling these
#     regexes do not know.
#   - It says nothing about a payload assembled in a file that imports no qzpay
#     symbol and is passed onward. That is a real gap, and it is bounded: the
#     helper that receives such an object would have to spread it blindly into
#     a create call, which is not how any current path is written.
#   - It says nothing about the LOCAL trial. Granting Hospeda's own trial,
#     extending it with a `trial_extension` promo code, and reading
#     `trialStart`/`trialEnd` off our own rows are all fine and are the whole
#     point of HOS-1012. What is banned is one direction only: a trial reaching
#     MERCADOPAGO.
#
#   There is deliberately NO per-line escape hatch. A comment that switches the
#   guard off for one line is how a fail-open re-enters, and the point of this
#   file is that the next person reaching for `freeTrialDays` in a preapproval
#   argues with a reviewer instead of with a regex.
#
# -----------------------------------------------------------------------------
# TESTABILITY / POSITIVE CONTROL
# -----------------------------------------------------------------------------
#   A guard that is green over a clean tree has proved nothing. `SCAN_FILES_OVERRIDE`
#   (env, newline-separated paths) replaces the derived file list verbatim, so
#   the guard can be pointed at a fixture that REINTRODUCES a banned field and
#   observed to exit 1. Mirrors `CHANGED_FILES_OVERRIDE` in
#   check-seed-dual-write.sh.
#
#     printf 'x.ts' > /tmp/x.ts   # containing e.g.  freeTrialDays: 30,
#     SCAN_FILES_OVERRIDE=/tmp/x.ts bash scripts/check-no-trial-to-mercadopago.sh
#     # expected: exit 1
#
# Exit codes: 0 = no trial field reaches MercadoPago; 1 = at least one does.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

echo "=== Checking no checkout sends a trial to MercadoPago (HOS-1012 G-1) ==="
echo ""

# Production source roots. Only these are searched for the qzpay import that
# puts a file in scope; test/build output never is.
SCAN_ROOTS="apps/api/src apps/admin/src apps/web/src packages/service-core/src packages/billing/src packages/db/src packages/schemas/src"

# The ONLY way Hospeda code reaches MercadoPago. Importing any of these puts a
# file in scope — this is the derivation that survives renames and moves.
QZPAY_IMPORT_PATTERN='@qazuor/qzpay-(core|mercadopago|drizzle|hono)'

# The banned names, wire spellings and ours. Kept as one alternation so the
# anchors below apply to all of them identically.
# Ordered longest-first so a `freeTrialDays` key can never be matched as a
# `freeTrial` prefix by an engine that is not leftmost-longest.
BANNED_ALTERNATION='freeTrialDays|freeTrial|free_trial|start_date'

# Object-literal positions, each ANCHORED on both sides:
#   KEY        `freeTrialDays:` / `readonly freeTrialDays?:` at a property slot
#   SHORTHAND  `{ freeTrialDays }` / `{ freeTrialDays,` / a line that is just `freeTrialDays,`
#   QUOTED     `'free_trial':` / `"free_trial":`
# The left fence is a line start or one of `{ , (` (plus `readonly`/`declare`
# style modifiers, which are absorbed by the leading whitespace class since they
# end in a space before the identifier — handled by the explicit modifier group).
KEY_PATTERN="(^|[{,(])[[:space:]]*((readonly|public|private|protected)[[:space:]]+)?(${BANNED_ALTERNATION})[[:space:]]*\\??[[:space:]]*:"
SHORTHAND_PATTERN="(^|[{,])[[:space:]]*(${BANNED_ALTERNATION})[[:space:]]*[,}]"
QUOTED_PATTERN="['\"](${BANNED_ALTERNATION})['\"][[:space:]]*:"

# -----------------------------------------------------------------------------
# compute_scan_files: the derived in-scope file list, unless SCAN_FILES_OVERRIDE
# is set (positive-control injection point).
# -----------------------------------------------------------------------------
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

    grep -rlE --include="*.ts" --include="*.tsx" \
        "${QZPAY_IMPORT_PATTERN}" \
        "${existing_roots[@]}" 2>/dev/null |
        grep -v '\.test\.' |
        grep -v '\.spec\.' ||
        true
}

SCAN_FILES="$(compute_scan_files)"

if [[ -z "${SCAN_FILES}" ]]; then
    # An empty scope is a BROKEN guard, not a clean tree: the derivation found
    # no file importing qzpay at all, which cannot be true of this repo. Fail
    # loudly rather than reporting a vacuous pass (a green run over zero files
    # is the classic silent fail-open).
    echo "ERROR: no in-scope files found." >&2
    echo "  Nothing under [${SCAN_ROOTS}] imports ${QZPAY_IMPORT_PATTERN}." >&2
    echo "  That cannot be right for this repo — the guard's file derivation is" >&2
    echo "  broken (moved source roots? renamed qzpay packages?). Fix the" >&2
    echo "  derivation; do not ignore this." >&2
    exit 1
fi

FILE_COUNT="$(printf '%s\n' "${SCAN_FILES}" | grep -c . || true)"
echo "  Scanning ${FILE_COUNT} production file(s) that import qzpay/MercadoPago."
echo ""

MATCHES=""
while IFS= read -r file; do
    [[ -z "${file}" ]] && continue
    [[ -f "${file}" ]] || continue
    FOUND="$(grep -nE "${KEY_PATTERN}|${SHORTHAND_PATTERN}|${QUOTED_PATTERN}" "${file}" 2>/dev/null |
        grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' |
        sed "s|^|${file}:|" || true)"
    if [[ -n "${FOUND}" ]]; then
        MATCHES="${MATCHES}${FOUND}"$'\n'
    fi
done <<<"${SCAN_FILES}"

MATCHES="$(printf '%s' "${MATCHES}" | sed '/^$/d')"

if [[ -n "${MATCHES}" ]]; then
    echo "ERROR: a free trial reaches MercadoPago."
    echo ""
    echo "${MATCHES}"
    echo ""
    echo "  Each line above puts a trial field in an object-literal position"
    echo "  inside a file that talks to MercadoPago. MercadoPago grants a"
    echo "  preapproval's free trial once per (payer, preapproval_plan) and"
    echo "  reports a spent one identically to a live one — in production it"
    echo "  charged ARS 18.000 one hundred and eighteen seconds after promising"
    echo "  fourteen free days (HOS-522)."
    echo ""
    echo "  Hospeda's trial is its own since HOS-1012: a local status='trialing'"
    echo "  row with mp_subscription_id = NULL, opened at the owner's first"
    echo "  publish. Grant it there. Extend it there. Checkout is the PAID path."
    echo ""
    echo "  If you are reading a trial off OUR row (trialStart / trialEnd), that"
    echo "  is fine and is not what this matched — re-read the line."
    exit 1
fi

echo "  OK - no trial field reaches MercadoPago from any checkout path."
echo ""
echo "All checks passed."
exit 0
