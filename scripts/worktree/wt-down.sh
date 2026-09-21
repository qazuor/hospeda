#!/usr/bin/env bash
# wt-down.sh — stop this worktree's servers ONLY. The DB and the worktree are
# preserved, so `wt-up` can bring it back instantly without re-provisioning.
# Run from INSIDE the worktree.
#
# Lifecycle: create ⇄ remove   (worktree exists ⇄ destroyed)
#            up     ⇄ down      (servers running ⇄ stopped)   ← this script
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$HERE/wt-config.sh"
ROOT="$(wt_root)"
[ -n "$ROOT" ] || { echo "ERROR: not inside a git repo"; exit 1; }

BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)"
echo "== wt-down: $ROOT ($BRANCH) =="

echo "-- stopping servers"
bash "$HERE/wt-servers.sh" stop || true

echo
echo "== wt-down done. Servers stopped; DB + worktree preserved. =="
echo "   wt-up      → restart the servers (instant, DB is kept)"
echo "   wt-remove  → tear everything down (servers + DB + worktree + branch)"
