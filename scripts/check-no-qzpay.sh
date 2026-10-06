#!/usr/bin/env bash
# =============================================================================
# check-no-qzpay.sh — TEST:U1:1 (HOS-1416)
#
# THE STATIC HALF OF THE DEMOLITION PROOF. AC:U1:1 says: no package.json or
# import declares `@qazuor/qzpay*`, and the routes/crons/adapter of the old
# billing system do not exist. The demolition commits removed them; this guard
# keeps them removed. It is the G16(a)-shaped walk for this tree.
#
# B1 (the next sheet of the epic) retires this file when a formal G16 guard is
# born to take over — until then this is the enforcement.
#
# WHAT IT PROVES
#
#   P-1  No `package.json` anywhere in the repo (workspace packages, apps,
#        tools) declares a dependency/devDependency/peerDependency/optional-
#        dependency whose name starts with `@qazuor/qzpay`. Script NAMES and
#        comments are not declarations and do not match (the matcher reads the
#        dependency sections, not the whole file).
#
#   P-2  No source file imports any `@qazuor/qzpay*` package — the bare name,
#        or any of the five siblings (-core, -mercadopago, -drizzle, -hono,
#        -react), in `src/**`, `test/**` and `scripts/**` of every workspace
#        project, extensions .ts/.tsx/.mts/.cts (plus .astro frontmatter, which
#        is TypeScript).
#
#   P-3  The old billing system's files and directories stay gone:
#          apps/api/src/routes/billing/
#          apps/api/src/routes/webhooks/mercadopago/
#          packages/db/src/billing/
#          apps/api/src/routes/test/qzpay-control.ts
#        and no file under `apps/api/src/cron/jobs/` carries the name of any
#        retired billing cron job.
#
# WHAT IT DOES NOT PROVE
#
#   - It cannot see a renamed re-export: code that reaches the same behaviour
#     through a locally vendored copy is out of scope. That would be NEW code,
#     which the demolition review covers; this guard stops accidental
#     resurrection, not determined forgery.
#   - The cron list is closed. Neutral exchange-rate and notification jobs
#     remain valid and are covered by their own tests.
#
# EXCLUDED FROM THE SCAN
#   node_modules, dist, .git, pnpm-lock.yaml (the lockfile is generated, and
#   an empty one is what this PR ships), .specs/, and this script itself (its
#   own patterns necessarily contain the banned strings).
#
# POSITIVE CONTROL
#   A guard green over a clean tree has proved nothing. Point SCAN_OVERRIDE at
#   a fixture that violates any rule and the guard must exit 1 naming it:
#
#     printf 'import { qz } from "@qazuor/qzpay-core";\n' > /tmp/x.ts
#     SCAN_OVERRIDE=/tmp/x.ts bash scripts/check-no-qzpay.sh   # exit 1
#
# Exit codes: 0 = clean; 1 = at least one violation (named).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

echo "=== Checking no qzpay billing surface remains (HOS-1416 TEST:U1:1) ==="
echo ""

VIOLATIONS=0

# --- scan source list --------------------------------------------------------
# All tracked files minus the exclusions; this script itself is skipped by the
# grep below (its patterns contain the banned strings by construction).
if [[ -n "${SCAN_OVERRIDE:-}" ]]; then
    # Positive-control injection point: replaces the derived list verbatim.
    SCAN_FILES="$(printf '%s\n' "${SCAN_OVERRIDE}")"
else
    SCAN_FILES="$(git ls-files -co --exclude-standard \
        | grep -vE '(^|/)(node_modules|dist|\.git|\.specs)/' \
        | grep -v '^pnpm-lock\.yaml$' \
        | grep -v '^scripts/check-no-qzpay\.sh$' || true)"
fi

# --- P-1: no package.json declares a qzpay dependency ------------------------
echo "1. package.json dependency declarations..."
QZPAY_DEP_LINE='^[[:space:]]*"@qazuor/qzpay'
while IFS= read -r -d '' file; do
    FOUND="$(sed -n '/"[[:space:]]*dependencies[[:space:]]*":/,/}/p;/"[[:space:]]*devDependencies[[:space:]]*":/,/}/p;/"[[:space:]]*peerDependencies[[:space:]]*":/,/}/p;/"[[:space:]]*optionalDependencies[[:space:]]*":/,/}/p' "${file}" \
        | grep -E "${QZPAY_DEP_LINE}" || true)"
    if [[ -n "${FOUND}" ]]; then
        echo "  FAIL ${file}"
        printf '%s\n' "${FOUND}" | sed 's/^/       /'
        VIOLATIONS=$((VIOLATIONS + 1))
    fi
done < <(find . -name package.json \
    -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path './.git/*' -print0)
if [[ ${VIOLATIONS} -eq 0 ]]; then
    echo "  OK"
fi
echo ""

# --- P-2: no source file imports a qzpay package -----------------------------
echo "2. source imports..."
IMPORT_PATTERN='@qazuor/qzpay(-core|-mercadopago|-drizzle|-hono|-react)?'
SOURCE_MATCHES="$(printf '%s\n' "${SCAN_FILES}" \
    | grep -E '\.(ts|tsx|mts|cts|astro)$' \
    | xargs -r grep -lE "['\"]${IMPORT_PATTERN}['\"]" 2>/dev/null || true)"
if [[ -n "${SOURCE_MATCHES}" ]]; then
    printf '%s\n' "${SOURCE_MATCHES}" | sed 's/^/  FAIL /'
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "  OK"
fi
echo ""

# --- P-3: the demolished billing surface stays gone ---------------------------
echo "3. old billing routes/adapter/crons..."
MUST_NOT_EXIST=(
    'apps/api/src/routes/billing'
    'apps/api/src/routes/webhooks/mercadopago'
    'packages/db/src/billing'
    'apps/api/src/routes/test/qzpay-control.ts'
)
for path in "${MUST_NOT_EXIST[@]}"; do
    if [[ -e "${path}" ]]; then
        echo "  FAIL ${path} exists — the demolition removed it."
        VIOLATIONS=$((VIOLATIONS + 1))
    fi
done
if [[ ${VIOLATIONS} -eq 0 ]]; then
    echo "  OK (routes, webhooks and adapter absent)"
fi

# The billing cron jobs the demolition removed. Any
# FILE under apps/api/src/cron/jobs/ carrying one of these names resurrects the
# job it was named for.
BANNED_CRONS=(
    dunning webhook-retry finalize-cancelled-subs trial-expiry
    trial-series-dispatch addon-expiry addon-subscription-reconcile
    apply-scheduled-plan-changes subscription-poll abandoned-pending-subs
    preapproval-less-expiry entity-subscription-cache-reconcile
    courtesy-expiry partner-expiry partner-payment-review partner-unpaid-reaper
    propagate-plan-price-changes reactivation-supersession-reconcile
    subscription-drift-reconcile featured-by-entitlement-reconcile
)
CRON_DIR='apps/api/src/cron/jobs'
CRON_HITS=''
if [[ -d "${CRON_DIR}" ]]; then
    for name in "${BANNED_CRONS[@]}"; do
        for candidate in "${CRON_DIR}/${name}.ts" "${CRON_DIR}/${name}.job.ts"; do
            [[ -e "${candidate}" ]] && CRON_HITS+="${candidate}"$'\n'
        done
    done
fi
if [[ -n "${CRON_HITS}" ]]; then
    printf '%s' "${CRON_HITS}" | sed 's/^/  FAIL /'
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "  OK (no retired billing cron files present)"
fi
echo ""

if [[ ${VIOLATIONS} -gt 0 ]]; then
    echo "ERROR: ${VIOLATIONS} qzpay violation group(s) found. The legacy billing"
    echo "  system was demolished (HOS-1416); nothing under this repo may declare,"
    echo "  import or resurrect it."
    exit 1
fi

echo "All checks passed."
exit 0
