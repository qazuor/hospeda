#!/usr/bin/env bash
#
# Resolves "the commit this change is measured against" for the CI jobs that
# work off a diff rather than the whole tree:
#
#   - the Security job's `semgrep --baseline-commit`
#   - the Guards job's seed dual-write check (`BASE_SHA`)
#
# Each trigger names that commit differently, and `workflow_dispatch` does not
# name it at all — `github.event.before` is empty on a manual run. Leaving it
# empty is not a soft degradation:
#
#   - `check-seed-dual-write.sh` exits 1 outright when `BASE_SHA` is unset, so
#     every manually dispatched run would fail Guards for a reason that has
#     nothing to do with the code.
#   - semgrep silently drops `--baseline-commit` and scans the entire repo, so
#     pre-existing findings surface as if this run had introduced them.
#
# Both failure modes produce a red CI that means nothing, which is worse than
# no CI at all. This script gives the manual run the same baseline a PR would
# have used: the merge-base with the integration branch.
#
# Writes `CI_BASELINE_SHA` to $GITHUB_ENV for later steps in the same job.
#
# Inputs (all via env, all optional — the script picks the first that applies):
#   PR_BASE_SHA   `github.event.pull_request.base.sha`  (pull_request runs)
#   PUSH_BEFORE   `github.event.before`                 (push runs)
#   BASELINE_REF  branch to diff against on a manual run (default: staging)
#
# Fails closed: if no baseline can be resolved, exit non-zero rather than let
# the dependent guards run unanchored.

set -euo pipefail

readonly NULL_SHA='0000000000000000000000000000000000000000'

resolved=''
source_label=''

if [ -n "${PR_BASE_SHA:-}" ]; then
    resolved="${PR_BASE_SHA}"
    source_label='pull_request base'
elif [ -n "${PUSH_BEFORE:-}" ] && [ "${PUSH_BEFORE}" != "${NULL_SHA}" ]; then
    resolved="${PUSH_BEFORE}"
    source_label='push before-commit'
else
    # workflow_dispatch, or the very first push on a new branch (where
    # `before` is the null SHA). Diff against the integration branch, which is
    # the same anchor the eventual PR will use.
    ref="${BASELINE_REF:-staging}"

    # `fetch-depth: 0` gives full history for the checked-out ref, but the
    # baseline branch is not guaranteed to be present as a remote-tracking ref.
    if ! git rev-parse --verify --quiet "origin/${ref}" >/dev/null 2>&1; then
        git fetch --no-tags origin "${ref}:refs/remotes/origin/${ref}" >/dev/null 2>&1 || true
    fi

    if git rev-parse --verify --quiet "origin/${ref}" >/dev/null 2>&1; then
        resolved="$(git merge-base HEAD "origin/${ref}")"
        source_label="merge-base with origin/${ref}"
    fi
fi

if [ -z "${resolved}" ]; then
    echo "[ci-baseline] ❌ Could not resolve a baseline commit." >&2
    echo "[ci-baseline]    PR_BASE_SHA='${PR_BASE_SHA:-}' PUSH_BEFORE='${PUSH_BEFORE:-}' BASELINE_REF='${BASELINE_REF:-staging}'" >&2
    echo "[ci-baseline]    The diff-based guards cannot run unanchored — failing instead of scanning nothing." >&2
    exit 1
fi

echo "[ci-baseline] ✓ baseline = ${resolved} (${source_label})"
echo "CI_BASELINE_SHA=${resolved}" >> "${GITHUB_ENV}"
