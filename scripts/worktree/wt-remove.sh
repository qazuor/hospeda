#!/usr/bin/env bash
# wt-remove.sh [<worktree-path>] [--force] [--remote]
#   Tear a worktree down COMPLETELY: stop servers + drop DB + remove the worktree
#   + delete the local branch (+ remote with --remote). The opposite of wt-create.
#
#   Works from ANYWHERE:
#   - From INSIDE the target worktree (no path arg) — it stops servers, drops the
#     DB, then cd's to the main repo to run `git worktree remove` (git cannot
#     self-remove a worktree). Your shell is left in a now-deleted directory, so
#     it prints a `cd <main-repo>` reminder at the end.
#   - From the main repo with an explicit <worktree-path>.
#
# Safety (without --force):
#   - Uncommitted changes in the worktree  → ABORTS before touching anything.
#   - Unmerged branch                       → `git branch -d` refuses, so the
#     branch survives (committed work is never lost); re-run with --force to -D.
#
# Lifecycle: create ⇄ remove   ← this script
#            up     ⇄ down
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$HERE/wt-config.sh"

INVOKED_PWD="$PWD"   # capture where the user's shell is, before we cd anywhere

# Parse args: optional positional path + flags.
TARGET=""; FORCE=0; REMOTE=0
for a in "$@"; do
  case "$a" in
    --force) FORCE=1 ;;
    --remote) REMOTE=1 ;;
    -*) echo "unknown flag: $a"; exit 2 ;;
    *) TARGET="$a" ;;
  esac
done

# Resolve target: explicit arg, or the worktree the shell is currently in.
if [ -z "$TARGET" ]; then
  TARGET="$(wt_root)"
  [ -n "$TARGET" ] || { echo "ERROR: no <worktree-path> given and not inside a worktree"; exit 1; }
fi
TARGET="$(realpath -m "$TARGET" 2>/dev/null || echo "$TARGET")"
[ -d "$TARGET" ] || { echo "ERROR: worktree path does not exist: $TARGET"; exit 1; }

BRANCH="$(git -C "$TARGET" rev-parse --abbrev-ref HEAD 2>/dev/null)"
MAIN="$(git -C "$TARGET" worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2; exit}')"
[ -n "$MAIN" ] || { echo "ERROR: could not resolve the main repo path"; exit 1; }

if [ "$TARGET" = "$MAIN" ]; then
  echo "REFUSING: '$TARGET' is the main repo, not a worktree."
  exit 1
fi

echo "== wt-remove: $TARGET ($BRANCH) =="

# Safety guard 1: refuse to discard uncommitted work unless --force.
if [ "$FORCE" -ne 1 ] && [ -n "$(git -C "$TARGET" status --porcelain 2>/dev/null)" ]; then
  echo "ABORT: '$TARGET' has uncommitted changes. Commit/stash them, or re-run with --force to discard."
  exit 1
fi

# Step 1 — stop servers (operate in the target's context).
echo "-- stopping servers"
( cd "$TARGET" && bash "$HERE/wt-servers.sh" stop ) || true

# Step 2 — drop the per-worktree DB.
CFG="$(cd "$TARGET" && wt_config_path)"
if [ -f "$CFG" ] && [ "$(jq -r '.db.mode // "none"' "$CFG")" != "none" ]; then
  echo "-- dropping per-worktree database"
  ( cd "$TARGET" && bash "$HERE/wt-db.sh" drop ) || true
fi

# Step 3 — remove the worktree. cd OUT of the target first so this process is not
# sitting inside the directory git is about to delete; use git -C for good measure.
cd "$MAIN" || { echo "ERROR: cannot cd to main repo $MAIN"; exit 1; }
echo "-- git worktree remove $TARGET"
if [ "$FORCE" -eq 1 ]; then
  git -C "$MAIN" worktree remove --force "$TARGET" 2>&1 || { echo "ERROR: worktree remove failed"; exit 1; }
else
  git -C "$MAIN" worktree remove "$TARGET" 2>&1 \
    || { echo "ERROR: worktree remove refused (dirty/locked) — review, then re-run with --force"; exit 1; }
fi

# Step 4 — delete the local branch.
echo "-- deleting local branch $BRANCH"
if [ "$FORCE" -eq 1 ]; then
  git -C "$MAIN" branch -D "$BRANCH" 2>&1 || true
else
  git -C "$MAIN" branch -d "$BRANCH" 2>&1 \
    || echo "  (kept: branch '$BRANCH' is not fully merged — re-run with --force to delete it)"
fi

# Step 5 — optionally delete the remote branch.
if [ "$REMOTE" -eq 1 ]; then
  echo "-- deleting remote branch origin/$BRANCH"
  git -C "$MAIN" push origin --delete "$BRANCH" 2>&1 || echo "  (remote delete failed or already gone)"
fi

echo
echo "== wt-remove done. Worktree + DB gone. =="
# If the user's shell was inside the deleted worktree, it is now in a stale dir.
case "$INVOKED_PWD" in
  "$TARGET"|"$TARGET"/*)
    echo "NOTE: your shell is in a directory that no longer exists. Run:  cd $MAIN" ;;
esac
