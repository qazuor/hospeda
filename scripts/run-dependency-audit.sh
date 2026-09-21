#!/usr/bin/env bash
# run-dependency-audit.sh
#
# Runs `pnpm audit --prod --audit-level=high` and distinguishes two failure
# modes that otherwise look identical (both are a non-zero exit code):
#
#   1. A real finding: a production dependency carries a critical/high
#      vulnerability. This MUST block CI.
#   2. A failure to get a complete answer from registry.npmjs.org's
#      advisories endpoint (`/-/npm/v1/security/advisories/bulk`) — a
#      timeout, a connection error, or a bad (5xx/non-JSON) response. This
#      says nothing about our dependencies and must NOT block CI.
#
# Why this exists (HOS-1136): the endpoint was down for hours on 2026-09-03.
# `pnpm audit` failed with a timeout, and because it ran as the first step of
# a single `Security` job (no `continue-on-error`), the semgrep SAST step
# that followed never ran either — an unrelated third-party outage silently
# skipped the code-security scan. HOS-1136 option (1) splits dependency audit
# and SAST into independent jobs so one's outcome never gates the other; this
# script implements HOS-1136 option (4) on top of that split.
#
# STRUCTURE, NOT TEXT (HOS-1136 review, round 2). The first version of this
# script decided "did the audit complete?" by grepping pnpm's human-readable
# summary line (`N vulnerabilities found` / `Severity: ...`). That line is
# chalk-colorized — pnpm 11.18.0 wraps the NUMBER in ANSI codes
# (`\e[31m15\e[39m vulnerabilities found`), so `^[0-9]+ vulnerabilit(y|ies)
# found` silently stops matching the instant `FORCE_COLOR=1` is set (already
# a live convention in this repo, see scripts/dev-all.js) or a future pnpm
# release reformats the line. When that anchor goes dark, a real finding
# falls through to the network-exemption check below, and if the finding's
# OWN advisory title happens to mention a network term (a real vulnerability
# can legitimately be titled "DoS via socket hang up" — advisory text is
# free-form and not under this script's control), it exits 0 with a
# critical/high finding still present. `--json` sidesteps the whole class:
# `metadata.vulnerabilities` is computed from the exact same advisory set the
# exit code is based on, and it is either present in valid, parseable JSON or
# it is not — there is no color, no wording, and no future pnpm release to
# keep pace with.
set -uo pipefail

# Overridable only for tests (see scripts/__tests__/run-dependency-audit.test.ts) —
# production CI always gets the 300s default. Without a hard cap, an endpoint
# that accepts the TCP connection and then never answers lets pnpm's own
# retry loop run long enough that GitHub's `timeout-minutes` kills the whole
# JOB instead, which looks exactly like every other timed-out job and is
# indistinguishable from a real hang — defeating the one thing this script
# exists to do. Exit 124 (GNU coreutils `timeout`'s own "killed after the
# deadline" code) is treated as a network failure below.
readonly AUDIT_TIMEOUT_SECONDS="${AUDIT_TIMEOUT_SECONDS_OVERRIDE:-300}"

STDOUT_FILE="$(mktemp)"
STDERR_FILE="$(mktemp)"
if [ -z "${STDOUT_FILE}" ] || [ -z "${STDERR_FILE}" ]; then
    echo "::error::run-dependency-audit.sh: mktemp failed while preparing to capture pnpm audit's output. This is an environment problem, not an audit result — failing closed without running pnpm." >&2
    exit 1
fi
readonly STDOUT_FILE STDERR_FILE
trap 'rm -f "${STDOUT_FILE}" "${STDERR_FILE}"' EXIT

timeout "${AUDIT_TIMEOUT_SECONDS}" pnpm audit --prod --audit-level=high --json \
    >"${STDOUT_FILE}" 2>"${STDERR_FILE}"
AUDIT_EXIT_CODE=$?
readonly AUDIT_EXIT_CODE

# Surface what pnpm printed in the job log — --json's report on stdout, plus
# any progress/warning/error text pnpm sends to stderr regardless of --json.
cat "${STDERR_FILE}" >&2
cat "${STDOUT_FILE}"

if [ "${AUDIT_EXIT_CODE}" -eq 0 ]; then
    echo "[dependency-audit] OK: no critical/high vulnerabilities in production dependencies."
    exit 0
fi

# Valid JSON shaped like a real audit report is proof the registry answered
# and pnpm finished evaluating the dependency tree — checked BEFORE anything
# else, and it always wins. `jq -e` fails (non-zero) on invalid/empty JSON
# and on JSON that parses but lacks `.metadata.vulnerabilities` (an error
# object pnpm might emit on a handled failure has neither).
if jq -e '.metadata.vulnerabilities' "${STDOUT_FILE}" >/dev/null 2>&1; then
    echo "::error::pnpm audit completed and reported a real finding (production dependency at critical/high severity). Failing the build."
    exit "${AUDIT_EXIT_CODE}"
fi

# No valid completed report. Only now do we check for a recognized
# network/availability failure — the exact strings from the 2026-09-03
# incident log (HOS-1136), pnpm's own bad-response error, generic
# network-layer error names, and the timeout wrapper's own exit code (124).
readonly NETWORK_ERROR_PATTERN='TimeoutError: The operation was aborted due to timeout|operation was aborted due to timeout|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|FetchError|network timeout at|socket hang up|ERR_PNPM_AUDIT_BAD_RESPONSE|responded with 5[0-9][0-9]|returned invalid JSON'

if [ "${AUDIT_EXIT_CODE}" -eq 124 ] || grep -qE "${NETWORK_ERROR_PATTERN}" "${STDOUT_FILE}" "${STDERR_FILE}"; then
    MESSAGE="pnpm audit could not get a complete answer from the npm advisories endpoint (network/timeout/bad-response failure, not a vulnerability finding — see HOS-1136). Treating this run as inconclusive instead of failing the build. Re-run 'pnpm audit --prod --audit-level=high' locally once the endpoint recovers to confirm dependencies are clean."
    echo "::warning::${MESSAGE}"
    # A `::warning::` line only surfaces on the annotations tab, which nobody
    # checks on a green job — the same blind spot HOS-1136 filed against SAST,
    # now on the audit side: if the endpoint were ever misconfigured
    # permanently, this job stays green forever while auditing nothing, and
    # nothing about that is visible from CI Pass. The step summary renders on
    # the run's main page instead, where a green run is actually read.
    if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
        {
            echo "### ⚠️ Dependency audit skipped (network exemption — HOS-1136)"
            echo ""
            echo "${MESSAGE}"
        } >>"${GITHUB_STEP_SUMMARY}"
    fi
    exit 0
fi

echo "::error::pnpm audit failed without a valid completed JSON report and without a recognized network/timeout/bad-response signature — treating it as a real failure needing investigation. See HOS-1136 for the network exemption this does NOT match."
exit "${AUDIT_EXIT_CODE}"
