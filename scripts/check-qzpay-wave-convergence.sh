#!/usr/bin/env bash
# check-qzpay-wave-convergence.sh
#
# HOS-232, and its 2026-09-01 recurrence.
#
# THE PROVEN CASE
#   The five qzpay siblings (-core, -mercadopago, -drizzle, -hono, -react) do
#   not depend on core through a RANGE: every sibling release pins core to an
#   EXACT version, and each core release ships with a matching republish of all
#   five. So a wave converges on one core on its own — as long as the whole wave
#   is installed.
#
#   Raise one package alone and it does not fail to resolve. It installs
#   alongside the others and the tree ends up holding TWO core versions, which
#   splits `QZPayBilling` / `QZPayEventMap` into two type identities. That is
#   HOS-232, and `pnpm-workspace.yaml` documents it at length.
#
#   Measured on `staging` on 2026-09-01: `pnpm-lock.yaml` held core 5.0.0 AND
#   5.1.0. The workspace packages declared `^5.1.0` directly (raised on its own
#   to pick up `payerEmail`, HOS-937) while drizzle 2.0.0, hono 1.6.11, react
#   1.1.26 and mercadopago 2.9.2 each still pinned 5.0.0. npm already had all
#   four republished against 5.1.0; nobody had installed them.
#
# WHY A GUARD AND NOT A TEST RUN
#   Nothing was failing. 5.1.0 added one optional field, so the two identities
#   were structurally compatible: `tsc` passed on api, admin and web, and the
#   billing suites were green. The split is only visible by COUNTING, which is
#   exactly the kind of check a human does once and then never again.
#
#   The day core carries something non-additive, the same split stops being
#   benign — and by then it has had months to spread to more siblings.
#
# WHAT IT PROVES
#   `pnpm-lock.yaml` resolves exactly ONE version of @qazuor/qzpay-core.
#
# WHAT IT DOES NOT PROVE
#   - It says nothing about WHICH version. A wave that converges on an old core
#     passes; the version floors are prose in `pnpm-workspace.yaml`'s HISTORY
#     section, and are not machine-checked here.
#   - It reads the lockfile, not `node_modules`. A lockfile that is correct and
#     an install that was never run still passes.
#   - It only covers core. A sibling that lagged without changing which core it
#     pins is invisible to this check — but that case cannot split the type
#     identity, which is the failure this exists to prevent.
#
# HOW TO FIX A FAILURE
#   Do NOT add a pnpm override — that re-hides the split (see
#   `pnpm-workspace.yaml`, "WHAT IT WAS HIDING"). Install the lagging siblings:
#
#     npm view @qazuor/qzpay-drizzle@latest dependencies.@qazuor/qzpay-core
#
#   Raise all five workspace declarations to the wave that pins one core, then
#   `CI=true corepack pnpm install --no-frozen-lockfile`.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCKFILE="$REPO_ROOT/pnpm-lock.yaml"

echo "=== Checking qzpay wave convergence ==="

if [ ! -f "$LOCKFILE" ]; then
    echo "  FAIL — pnpm-lock.yaml not found at $LOCKFILE"
    exit 1
fi

# Snapshot keys look like:  '@qazuor/qzpay-core@5.1.0':
# Match the version-bearing form only, so a bare package name never counts.
CORE_VERSIONS="$(grep -oE "'@qazuor/qzpay-core@[0-9]+\.[0-9]+\.[0-9]+'" "$LOCKFILE" \
    | sed -E "s/'@qazuor\/qzpay-core@([0-9.]+)'/\1/" \
    | sort -u)"

if [ -z "$CORE_VERSIONS" ]; then
    echo "  FAIL — no @qazuor/qzpay-core version found in the lockfile."
    echo "         Either the dependency is gone (then delete this guard) or the"
    echo "         lockfile format changed and this check is now blind."
    exit 1
fi

COUNT="$(printf '%s\n' "$CORE_VERSIONS" | wc -l | tr -d ' ')"

if [ "$COUNT" -ne 1 ]; then
    echo "  FAIL — $COUNT versions of @qazuor/qzpay-core resolved in pnpm-lock.yaml:"
    printf '           %s\n' $CORE_VERSIONS
    echo
    echo "  The qzpay wave is split. Every sibling pins core EXACTLY, so two core"
    echo "  versions mean two \`QZPayBilling\` type identities in one tree — the"
    echo "  HOS-232 failure. This can pass typecheck and every test suite and"
    echo "  still be wrong."
    echo
    echo "  Which sibling is holding back the old one:"
    echo "    rg -A3 \"^  '@qazuor/qzpay-(drizzle|hono|react|mercadopago)@\" pnpm-lock.yaml"
    echo
    echo "  Fix by installing the whole current wave — never with a pnpm override."
    echo "  See pnpm-workspace.yaml, the qzpay comment block in \`overrides\`."
    exit 1
fi

echo "  OK — single @qazuor/qzpay-core version resolved: $CORE_VERSIONS"
echo
echo "=== Results: 1/1 checks passed ==="
exit 0
