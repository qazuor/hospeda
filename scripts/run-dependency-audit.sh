#!/usr/bin/env bash
# run-dependency-audit.sh
#
# Runs `pnpm audit --prod --audit-level=high` and distinguishes two failure
# modes that otherwise look identical (both are a non-zero exit code):
#
#   1. A real finding: a production dependency carries a critical/high
#      vulnerability. This MUST block CI.
#   2. A network-layer failure reaching registry.npmjs.org's advisories
#      endpoint (`/-/npm/v1/security/advisories/bulk`), which says nothing
#      about our dependencies at all. This must NOT block CI.
#
# Why this exists (HOS-1136): the endpoint was down for hours on 2026-09-03.
# `pnpm audit` failed with a timeout, and because it ran as the first step of
# a single `Security` job (no `continue-on-error`), the semgrep SAST step
# that followed never ran either — an unrelated third-party outage silently
# skipped the code-security scan. HOS-1136 option (1) splits dependency audit
# and SAST into independent jobs so one's outcome never gates the other; this
# script implements HOS-1136 option (4) on top of that split, so a registry
# outage on this job specifically stops reading as "found a vulnerability".
#
# Fails closed on anything it does not recognize: only the exact network
# error signatures below are treated as inconclusive-not-failing. Any other
# non-zero exit (including a real advisory finding) still fails the build.
set -uo pipefail

OUTPUT_FILE="$(mktemp)"
readonly OUTPUT_FILE
trap 'rm -f "${OUTPUT_FILE}"' EXIT

pnpm audit --prod --audit-level=high 2>&1 | tee "${OUTPUT_FILE}"
readonly AUDIT_EXIT_CODE="${PIPESTATUS[0]}"

if [ "${AUDIT_EXIT_CODE}" -eq 0 ]; then
    echo "[dependency-audit] OK: no critical/high vulnerabilities in production dependencies."
    exit 0
fi

# Signatures observed on the 2026-09-03 registry.npmjs.org advisories-endpoint
# outage (the exact strings from that job's raw log, per HOS-1136), plus the
# broader set of network-layer error names pnpm/npm/node surface for a
# request that never got an answer. None of these describe a vulnerability.
readonly NETWORK_ERROR_PATTERN='TimeoutError: The operation was aborted due to timeout|operation was aborted due to timeout|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|FetchError|network timeout at|socket hang up'

if grep -qE "${NETWORK_ERROR_PATTERN}" "${OUTPUT_FILE}"; then
    echo "::warning::pnpm audit could not reach the npm advisories endpoint (network/timeout error, not a vulnerability finding — see HOS-1136). Treating this run as inconclusive instead of failing the build. Re-run 'pnpm audit --prod --audit-level=high' locally once the endpoint recovers to confirm dependencies are clean."
    exit 0
fi

echo "::error::pnpm audit failed with a finding that is not a recognized network/timeout error — treating it as a real result (a vulnerability, or an audit failure needing investigation). See HOS-1136 for the network-timeout exemption this does NOT match."
exit "${AUDIT_EXIT_CODE}"
