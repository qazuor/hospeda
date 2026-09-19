#!/usr/bin/env bash
# wt-cleanup.sh teardown [--refresh-template]
#     Run from INSIDE the worktree being finished. Kills its servers, optionally
#     refreshes the shared DB template (post-merge, only if schema/seed changed),
#     drops the per-worktree DB. Prints the handoff for the destructive remove.
#
# wt-cleanup.sh remove <worktree-path> <branch> [--remote] [--force]
#     Run from the MAIN repo (NOT inside the target). Removes the worktree, the
#     local branch (-d, or -D with --force), and optionally the remote branch.
#     Refuses to remove the worktree the current shell is inside.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$HERE/wt-config.sh"
SUB="${1:?usage: wt-cleanup.sh teardown|remove ...}"; shift || true

case "$SUB" in
  teardown)
    REFRESH=0; [ "${1:-}" = "--refresh-template" ] && REFRESH=1
    ROOT="$(wt_root)"; CFG="$(wt_config_path)"
    [ -n "$ROOT" ] || { echo "Not in a git repo"; exit 1; }
    BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)"

    echo "== teardown: $ROOT ($BRANCH) =="
    echo "-- stopping servers"
    bash "$HERE/wt-servers.sh" stop || true

    if [ -f "$CFG" ] && [ "$(jq -r '.db.mode // "none"' "$CFG")" != "none" ]; then
      if [ "$REFRESH" -eq 1 ]; then
        BASE="$(jq -r '.baseBranch' "$CFG")"
        # Refresh the shared template only if this branch changed schema/seed.
        changed="$(git -C "$ROOT" diff --name-only "$BASE"...HEAD -- packages/db packages/seed 2>/dev/null)"
        if [ -n "$changed" ]; then
          echo "-- schema/seed changed vs $BASE → refreshing template BEFORE drop"
          bash "$HERE/wt-db.sh" refresh-template || echo "WARN: template refresh failed"
        else
          echo "-- no schema/seed change vs $BASE → template untouched"
        fi
      fi
      echo "-- dropping per-worktree DB"
      bash "$HERE/wt-db.sh" drop || true
    fi

    # Resolve the main repo path (first worktree in the list).
    MAIN="$(git -C "$ROOT" worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2; exit}')"
    echo
    echo "== teardown done. Destructive remove must run from the MAIN repo: =="
    echo "  cd $MAIN"
    echo "  bash $HERE/wt-cleanup.sh remove $ROOT $BRANCH --remote"
    echo "(add --force if the local branch refuses -d due to patch-id divergence)"
    ;;

  remove)
    WTPATH="${1:?usage: wt-cleanup.sh remove <worktree-path> <branch> [--remote] [--force]}"
    BRANCH="${2:?missing <branch>}"; shift 2 || true
    REMOTE=0; FORCE=0
    for a in "$@"; do [ "$a" = "--remote" ] && REMOTE=1; [ "$a" = "--force" ] && FORCE=1; done

    CUR_TOP="$(git rev-parse --show-toplevel 2>/dev/null)"
    WT_ABS="$(realpath -m "$WTPATH" 2>/dev/null || echo "$WTPATH")"
    if [ "$CUR_TOP" = "$WT_ABS" ] || [ "${PWD#"$WT_ABS"}" != "$PWD" ]; then
      echo "REFUSING: current shell is inside '$WT_ABS'. Run this from the main repo."
      exit 1
    fi

    echo "-- git worktree remove $WT_ABS"
    git worktree remove "$WT_ABS" 2>&1 || { echo "remove failed (dirty? use git worktree remove --force after review)"; exit 1; }

    echo "-- deleting local branch $BRANCH"
    if [ "$FORCE" -eq 1 ]; then git branch -D "$BRANCH" 2>&1 || true
    else git branch -d "$BRANCH" 2>&1 || echo "  (-d refused; re-run with --force if branch is merged via squash/patch-id)"; fi

    if [ "$REMOTE" -eq 1 ]; then
      echo "-- deleting remote branch origin/$BRANCH"
      git push origin --delete "$BRANCH" 2>&1 || echo "  (remote delete failed or already gone)"
    fi
    echo "remove done."
    ;;

  *) echo "unknown subcommand: $SUB"; exit 1 ;;
esac
