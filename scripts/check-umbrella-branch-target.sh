#!/usr/bin/env bash
# check-umbrella-branch-target.sh — DEC-ARCH-007 / DEC-CI-001
#
# A branch cut from an umbrella integration branch may not target `staging`
# or `main`. Its only legal target is the umbrella itself.
#
# WHY
#
# A multi-epic program (the first one is HOS-1352) is developed on ONE
# integration branch, `epic/HOS-1352-verticales-billing`. Sub-epics and units
# branch off it and merge back into it; `staging` is merged INTO it
# periodically; and only the umbrella itself goes to `staging`, once, at the
# end. That rule exists so that shipping half of the program is not a decision
# somebody can get wrong: the unit that reaches `staging` is the umbrella.
# Written down as "don't do it", it is one wrong `--base` away from shipping a
# half-built billing system. This guard turns it into "it can't be done".
#
# WHAT IS CHECKED
#
# Ancestry, not branch names — a name can be changed, history cannot. The PR
# fails when HEAD contains at least one umbrella commit that the target branch
# does not have yet. Concretely: every merge-base between HEAD and the umbrella
# must already be an ancestor of the target. If one is not, HEAD carries
# umbrella-only work and is trying to deliver it to `staging`/`main` around
# the umbrella.
#
# Why not the simpler "is the umbrella TIP an ancestor of HEAD?":
#   - it misses every branch cut from an OLDER umbrella commit (the umbrella
#     moves forward, the branch does not, the tip is no longer in its history);
#   - it fires on EVERY PR to staging whenever the umbrella tip is itself in
#     staging — the day the umbrella is created from staging, and after any
#     fast-forward merge of staging into it — because a PR's merge commit
#     contains the target's tip.
# "Umbrella-only commits reachable from HEAD" has neither problem.
#
# WHAT IS ALLOWED
#
#   - The umbrella's own PR (head ref == the umbrella branch): it is the one
#     path the rule prescribes.
#   - Any PR whose target is not `staging` or `main` (a sub-epic -> umbrella
#     PR included).
#   - Everything, while the umbrella does not exist on the remote: there is
#     nothing to protect yet.
#
# KNOWN LIMITS (say them out loud)
#
#   - A branch cut from the umbrella while the umbrella had no commits of its
#     own carries nothing umbrella-only, so it is indistinguishable from a
#     normal staging branch and passes. It also delivers nothing of the
#     umbrella, so nothing is lost.
#   - The `staging -> main` promotion after the umbrella has landed in
#     `staging` DOES fail here while the umbrella branch still exists on the
#     remote. Deleting the umbrella branch once it is merged clears it.
#
# INPUTS (env, all optional)
#
#   GITHUB_BASE_REF   PR target branch. Empty (push, local run) -> skip.
#   GITHUB_HEAD_REF   PR source branch.
#   CI_BASELINE_SHA   commit the PR is measured against (set by
#                     scripts/resolve-ci-baseline.sh). Falls back to
#                     <remote>/<GITHUB_BASE_REF>.
#   UMBRELLA_BRANCH   default: epic/HOS-1352-verticales-billing
#   UMBRELLA_REMOTE   default: origin
#
# Exit: 0 allowed, 1 forbidden target or the check could not be completed
# (fails closed: a guard that cannot see the umbrella does not wave the PR
# through).

set -euo pipefail

readonly UMBRELLA_BRANCH="${UMBRELLA_BRANCH:-epic/HOS-1352-verticales-billing}"
readonly REMOTE="${UMBRELLA_REMOTE:-origin}"
readonly BASE_REF="${GITHUB_BASE_REF:-}"
readonly HEAD_REF="${GITHUB_HEAD_REF:-}"

case "${BASE_REF}" in
    staging | main) ;;
    *)
        echo "OK: target '${BASE_REF:-<none>}' is not staging/main — nothing to check."
        exit 0
        ;;
esac

if [ "${HEAD_REF}" = "${UMBRELLA_BRANCH}" ]; then
    echo "OK: '${HEAD_REF}' is the umbrella itself — its PR to ${BASE_REF} is the allowed path."
    exit 0
fi

umbrella_ref="refs/remotes/${REMOTE}/${UMBRELLA_BRANCH}"

if ! git rev-parse --verify --quiet "${umbrella_ref}" >/dev/null 2>&1; then
    # Not fetched locally. Ask the remote whether it exists at all:
    # `ls-remote --exit-code` returns 2 when no ref matches.
    set +e
    git ls-remote --exit-code --heads "${REMOTE}" "${UMBRELLA_BRANCH}" >/dev/null 2>&1
    ls_status=$?
    set -e
    if [ "${ls_status}" -eq 2 ]; then
        echo "OK: umbrella '${UMBRELLA_BRANCH}' does not exist on '${REMOTE}' — nothing to protect yet."
        exit 0
    fi
    if [ "${ls_status}" -ne 0 ]; then
        echo "FAIL: could not query '${REMOTE}' for '${UMBRELLA_BRANCH}' (git ls-remote exit ${ls_status})."
        exit 1
    fi
    if ! git fetch --no-tags "${REMOTE}" "+refs/heads/${UMBRELLA_BRANCH}:${umbrella_ref}" >/dev/null 2>&1; then
        echo "FAIL: '${UMBRELLA_BRANCH}' exists on '${REMOTE}' but could not be fetched."
        exit 1
    fi
fi

base="${CI_BASELINE_SHA:-}"
if [ -z "${base}" ]; then
    base_ref="refs/remotes/${REMOTE}/${BASE_REF}"
    if ! git rev-parse --verify --quiet "${base_ref}" >/dev/null 2>&1; then
        git fetch --no-tags "${REMOTE}" "+refs/heads/${BASE_REF}:${base_ref}" >/dev/null 2>&1 || true
    fi
    base="${base_ref}"
fi
if ! git rev-parse --verify --quiet "${base}^{commit}" >/dev/null 2>&1; then
    echo "FAIL: cannot resolve the target commit '${base}' for '${BASE_REF}'."
    exit 1
fi

# No common history at all: HEAD cannot carry umbrella commits.
merge_bases="$(git merge-base --all HEAD "${umbrella_ref}" || true)"

for mb in ${merge_bases}; do
    if ! git merge-base --is-ancestor "${mb}" "${base}"; then
        echo "FAIL (DEC-ARCH-007): this branch carries commits of '${UMBRELLA_BRANCH}' that '${BASE_REF}' does not have."
        echo "  A branch cut from the umbrella may not target staging or main."
        echo "  Retarget the PR to '${UMBRELLA_BRANCH}'. Only the umbrella's own PR goes to ${BASE_REF}."
        echo "  Umbrella-only commit shared with HEAD: $(git rev-parse --short "${mb}")"
        exit 1
    fi
done

echo "OK: no umbrella-only commit of '${UMBRELLA_BRANCH}' reaches '${BASE_REF}' through this branch."
