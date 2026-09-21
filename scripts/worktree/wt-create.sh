#!/usr/bin/env bash
# wt-create.sh <type> <slug> — create a worktree from baseBranch, copy env,
# install, build, and init the worktree state file. Run from the MAIN repo.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$HERE/wt-config.sh"
ROOT="$(wt_root)"; CFG="$(wt_config_path)"
[ -n "$ROOT" ] || { echo "Not in a git repo"; exit 1; }
[ -f "$CFG" ] || { echo "NO_CONFIG — create .claude/project.config.json first"; exit 2; }

TYPE="${1:?usage: wt-create.sh <type> <slug>}"
SLUG="${2:?usage: wt-create.sh <type> <slug>}"

BASE="$(jq -r '.baseBranch' "$CFG")"
PATHPAT="$(jq -r '.worktree.pathPattern' "$CFG")"
BRANCHPAT="$(jq -r '.worktree.branchPattern' "$CFG")"
BRANCH="${BRANCHPAT//\{type\}/$TYPE}"; BRANCH="${BRANCH//\{slug\}/$SLUG}"
RELPATH="${PATHPAT//\{slug\}/$SLUG}"
WTPATH="$(realpath -m "$ROOT/$RELPATH" 2>/dev/null || echo "$ROOT/$RELPATH")"

# Already exists? reuse it.
if grep -Fq "branch refs/heads/$BRANCH" < <(git -C "$ROOT" worktree list --porcelain); then
  echo "EXISTS: worktree for branch '$BRANCH' already present — use it:"
  git -C "$ROOT" worktree list | grep "$BRANCH" || true
  exit 0
fi

echo "Creating worktree at: $WTPATH"
echo "  branch: $BRANCH  (cut from: $BASE)"
git -C "$ROOT" fetch origin "$BASE" --quiet 2>/dev/null || true
# Prefer the local base branch when it exists: the operational checkout may
# contain reviewed local commits that are intentionally not pushed yet. Fall
# back to origin/$BASE only when no local base ref is available.
if git -C "$ROOT" show-ref --verify --quiet "refs/heads/$BASE"; then
  START="$BASE"
elif git -C "$ROOT" show-ref --verify --quiet "refs/remotes/origin/$BASE"; then
  START="origin/$BASE"
else
  START="$BASE"
fi

# The shared template is the fast path, but it must never be silently stale.
# Compare the versioned source fingerprint with metadata stored inside the
# template DB. Missing metadata/journal is a legacy template and blocks create;
# build/promote a candidate first. The lock serializes this check with a future
# template promotion so a clone cannot race a rename.
TEMPLATE_DB="$(jq -r '.db.templateDb // empty' "$CFG")"
if [ -n "$TEMPLATE_DB" ] && command -v flock >/dev/null 2>&1; then
  TEMPLATE_LOCK="${XDG_RUNTIME_DIR:-/tmp}/hospeda-template.lock"
  exec 9>"$TEMPLATE_LOCK"
  flock 9
  TEMPLATE_STATUS="$(bash "$HERE/template.sh" status "$TEMPLATE_DB" 2>/dev/null || true)"
  CURRENT_TMPL_FP="$(wt_template_fingerprint_ref "$START")"
  STORED_TMPL_FP="$(printf '%s' "$TEMPLATE_STATUS" | jq -r '.manifest.fingerprint // empty' 2>/dev/null || true)"
  if [ -z "$CURRENT_TMPL_FP" ] || [ "$STORED_TMPL_FP" != "$CURRENT_TMPL_FP" ]; then
    echo "ERROR: DB template '$TEMPLATE_DB' is missing or stale for $START"
    echo "       Build and validate a candidate with:"
    echo "       bash $HERE/template.sh build-candidate hospeda_template_candidate_<date>"
    echo "       Then promote it explicitly before creating this worktree."
    exit 1
  fi
  echo "DB template is current vs $START — using fast clone"
fi

git -C "$ROOT" worktree add "$WTPATH" -b "$BRANCH" "$START" || { echo "git worktree add failed"; exit 1; }

# From here on, read setup.* from the WORKTREE'S OWN freshly-checked-out config
# (reflects $START exactly), not $CFG (the main repo's CURRENT checkout — which
# may sit on an unrelated, stale branch). Config-driven behavior changes to
# setup.envCopyScript/install/build only take effect once merged to baseBranch;
# reading from $CFG here would silently keep using whatever setup.* the main
# repo's own branch happens to have, which is how HOS-68's own build-step fix
# failed to apply on the very next /hops-start-issue run after merging. Falls back to
# $CFG if the new worktree somehow has no config of its own.
NEWCFG="$WTPATH/.claude/project.config.json"
[ -f "$NEWCFG" ] || NEWCFG="$CFG"

# Copy env (script must run from ROOT, absolute dest).
ECS="$(jq -r '.setup.envCopyScript // empty' "$NEWCFG")"
if [ -n "$ECS" ] && [ -f "$ROOT/$ECS" ]; then
  echo "Copying env via $ECS"
  ( cd "$ROOT" && bash "$ECS" "$WTPATH" ) || echo "WARN: env copy reported issues"
else
  echo "WARN: no envCopyScript ($ECS) — copy env files manually."
fi

# A clean base checkout may not contain ignored env files, and older staging
# branches may predate wt-env-prepare.sh altogether. When the migration/tooling
# checkout has the preparer, run it against the freshly-created worktree using
# that worktree's own examples. This supplies safe local placeholders without
# printing or inventing secrets; an operator can opt into a trusted real-env
# source with HOPS_ENV_SOURCE_ROOT before invoking wt-create.
ENV_PREPARE="$ROOT/scripts/worktree/wt-env-prepare.sh"
if [ -x "$ENV_PREPARE" ]; then
  echo "Preparing env defaults from the worktree examples"
  ( cd "$WTPATH" && bash "$ENV_PREPARE" ) || { echo "env prepare failed"; exit 1; }
fi

# Install + build inside the worktree (packages must build before dev).
INSTALL="$(jq -r '.setup.install // empty' "$NEWCFG")"
BUILD="$(jq -r '.setup.build // empty' "$NEWCFG")"
[ -n "$INSTALL" ] && { echo "Running: $INSTALL"; ( cd "$WTPATH" && eval "$INSTALL" ) || { echo "install failed"; exit 1; }; }
[ -n "$BUILD" ]   && { echo "Running: $BUILD";   ( cd "$WTPATH" && eval "$BUILD" )   || { echo "build failed"; exit 1; }; }

# client-tools is outside the pnpm workspace and needs its own Bun install.
CLIENT_TOOLS_INSTALL="$WTPATH/scripts/worktree/wt-client-tools-install.sh"
if [ -x "$CLIENT_TOOLS_INSTALL" ]; then
  bash "$CLIENT_TOOLS_INSTALL" "$WTPATH" || { echo "client-tools install failed"; exit 1; }
fi

# Init state file.
mkdir -p "$WTPATH/.claude"
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo unknown)"
jq -n --arg br "$BRANCH" --arg ts "$ts" \
  '{branch:$br, createdAt:$ts, servers:[], db:null}' > "$WTPATH/.claude/worktree-state.local.json"

echo
echo "DONE → $WTPATH"
echo "Entrá al worktree con:  cd $WTPATH"
echo "Luego ejecutá el agente que quieras (claude, opencode u otro)."
