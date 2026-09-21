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
# ORDER MATTERS. The completion-report check below runs BEFORE the
# network-signature check and always wins over it. An earlier version of
# this script checked the network signature against the audit's FULL output,
# which fails open: an advisory's own title/description is free text an
# upstream maintainer writes, and nothing stops a real vulnerability from
# being titled something like "DoS via socket hang up" or mentioning
# ECONNRESET/ETIMEDOUT as the bug itself — that text would match the network
# pattern and exit 0 with a real critical/high finding still present. A
# completed pnpm/npm audit ALWAYS ends with its own summary line(s)
# ("N vulnerabilities found" / "Severity: ..."), whether it found something
# or not (verified against a real dependency tree with known moderate/high
# findings, 2026-09-21) — their presence proves the registry answered and
# audit finished evaluating every dependency, which makes it a real result
# no matter what an advisory's own text happens to contain. Only a run with
# NO such summary — the registry never answered at all — is a candidate for
# the network exemption.
set -uo pipefail

OUTPUT_FILE="$(mktemp)"
readonly OUTPUT_FILE
trap 'rm -f "${OUTPUT_FILE}"' EXIT

pnpm audit --prod --audit-level=high 2>&1 | tee "${OUTPUT_FILE}"
AUDIT_EXIT_CODE="${PIPESTATUS[0]}"
readonly AUDIT_EXIT_CODE

if [ "${AUDIT_EXIT_CODE}" -eq 0 ]; then
    echo "[dependency-audit] OK: no critical/high vulnerabilities in production dependencies."
    exit 0
fi

# pnpm/npm's own completion summary — printed only once the registry has
# answered and audit finished evaluating the dependency tree, regardless of
# outcome. Its presence means this is a real result, full stop; checked
# BEFORE the network-signature check, and takes precedence over it.
if grep -qE '^[0-9]+ vulnerabilit(y|ies) found|^Severity: ' "${OUTPUT_FILE}"; then
    echo "::error::pnpm audit completed and reported a real finding (production dependency at critical/high severity). Failing the build."
    exit "${AUDIT_EXIT_CODE}"
fi

# No completion summary was printed anywhere in the output, so the registry
# never produced a report to evaluate at all — only now do we check whether
# the failure matches a known network/timeout signature. These are the exact
# strings from the 2026-09-03 incident log (HOS-1136), plus the broader set
# of network-layer error names pnpm/npm/node surface for a request that
# never got an answer.
readonly NETWORK_ERROR_PATTERN='TimeoutError: The operation was aborted due to timeout|operation was aborted due to timeout|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|FetchError|network timeout at|socket hang up'

if grep -qE "${NETWORK_ERROR_PATTERN}" "${OUTPUT_FILE}"; then
    echo "::warning::pnpm audit could not reach the npm advisories endpoint (network/timeout error, not a vulnerability finding — see HOS-1136). Treating this run as inconclusive instead of failing the build. Re-run 'pnpm audit --prod --audit-level=high' locally once the endpoint recovers to confirm dependencies are clean."
    exit 0
fi

echo "::error::pnpm audit failed without a completion summary or a recognized network/timeout signature — treating it as a real failure needing investigation. See HOS-1136 for the network-timeout exemption this does NOT match."
exit "${AUDIT_EXIT_CODE}"
