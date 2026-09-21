#!/usr/bin/env bash
# wt-guard-push.sh <branch> — orphan-commit guard.
# A merged PR is done: pushing more commits to its branch creates orphan commits
# that live on a closed-PR branch with no review surface.
# Exit 0 = safe to push. Exit 3 = PR is MERGED/CLOSED, do NOT push (cut a new branch).
set -uo pipefail
BR="${1:?usage: wt-guard-push.sh <branch>}"

state=$(GITHUB_TOKEN='' gh pr list --head "$BR" --state all --json state --jq '.[0].state // empty' 2>/dev/null)

case "$state" in
  MERGED|CLOSED)
    echo "BLOCK: PR for '$BR' is $state. A merged/closed PR is done — do NOT push."
    echo "→ Cut a new branch from the base for any follow-up:"
    echo "    git fetch origin && git checkout -b <type>/<slug> origin/<baseBranch>"
    exit 3 ;;
  OPEN)
    echo "OK: PR for '$BR' is OPEN — safe to push."
    exit 0 ;;
  *)
    echo "OK: no PR found for '$BR' — safe to push."
    exit 0 ;;
esac
