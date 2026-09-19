#!/usr/bin/env bash
# Safe bootstrap planner/verifier for an AI-assisted development workstation.
# This script is read-only. It never logs in, copies secrets, removes
# installations, restores Engram, mutates Git/Linear, or installs packages.
set -euo pipefail

usage() {
  cat <<'HELP'
Usage: ai-dev-workstation-bootstrap.sh [--plan|--dry-run|--verify] [options]

  --plan    print the reproducible installation plan (default)
  --dry-run alias for --plan; never writes or installs anything
  --verify  inspect available tools and versions without changing anything
  --backup-dir PATH  record the future backup destination in the plan
  --restore PATH     rejected until the apply/restore phase is implemented
  --help    show this help

The installer/apply phase is deliberately not implemented yet. Authentication,
secret restoration, Engram restore, plugin approval and deletion of old state
remain explicit human-controlled steps.
HELP
}

mode=plan
backup_dir=''
restore_path=''

# Operational compatibility pins. Change only after an isolated validation.
RUNTIME_CHANNEL="v1-gentle-compatible"
OPENCODE_PIN="1.18.31"
GENTLE_AI_PIN="2.9.0"
ENGRAM_PIN="1.20.0"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --plan|--dry-run) mode=plan ;;
    --verify) mode=verify ;;
    --backup-dir)
      [ "$#" -ge 2 ] || { echo 'ERROR: --backup-dir requiere PATH' >&2; exit 2; }
      backup_dir="$2"; shift ;;
    --restore)
      [ "$#" -ge 2 ] || { echo 'ERROR: --restore requiere PATH' >&2; exit 2; }
      restore_path="$2"; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if [ -n "$restore_path" ]; then
  echo 'ERROR: --restore todavía no está implementado; no se tocó nada.' >&2
  exit 3
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [ "$mode" = plan ]; then
  cat <<PLAN
AI development workstation bootstrap (read-only plan)

1. Back up OpenCode, Gentle-AI, Engram, Claude, CodeGraph and worktrees.
2. Verify Ubuntu/architecture and required base tools.
3. Install pinned Bun/Node, OpenCode, Gentle-AI and Engram versions.
4. Install client-tools from a reviewed checkout and expose hops wrappers.
5. Install versioned global TUI/skills/commands without credentials.
6. Verify checksums, permissions and read-only smoke commands.
7. Restore Engram only after backup and compatibility approval.
8. Print manual login/plugin/memory decisions; never automate them.

Current repository adapter candidate: $repo_root
Future backup destination: ${backup_dir:-'(not specified; no directory created)'}
Apply/install mode: intentionally unavailable
PLAN
  exit 0
fi

printf 'Bootstrap verification (read-only)\n'
printf 'repo=%s\n' "$repo_root"
printf 'runtime.channel=%s\n' "$RUNTIME_CHANNEL"
printf 'runtime.pins=opencode:%s|gentle-ai:%s|engram:%s\n' "$OPENCODE_PIN" "$GENTLE_AI_PIN" "$ENGRAM_PIN"
printf 'backup-dir=%s\n' "${backup_dir:-not-specified}"

check_tool() {
  local name="$1" command_name="$2"
  if command -v "$command_name" >/dev/null 2>&1; then
    local version
    version="$($command_name --version 2>/dev/null | head -n 1 || true)"
    printf 'tool.%s=present|%s\n' "$name" "${version:-version-unavailable}"
  else
    printf 'tool.%s=missing\n' "$name"
  fi
}

check_tool bash bash
check_tool git git
check_tool jq jq
check_tool bun bun
check_tool node node
check_tool opencode opencode
check_tool gentle_ai gentle-ai
check_tool engram engram

check_pinned_version() {
  local name="$1" command_name="$2" expected="$3" actual actual_version
  actual="$($command_name --version 2>/dev/null | head -n 1 || true)"
  actual_version="$(printf '%s' "$actual" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 || true)"
  if [ "$actual_version" = "$expected" ]; then
    printf 'pin.%s=ok|%s\n' "$name" "$actual"
  else
    printf 'pin.%s=mismatch|expected=%s|actual=%s\n' "$name" "$expected" "${actual:-version-unavailable}"
  fi
}

check_pinned_version opencode opencode "$OPENCODE_PIN"
check_pinned_version gentle_ai gentle-ai "$GENTLE_AI_PIN"
check_pinned_version engram engram "$ENGRAM_PIN"

for path in \
  "$HOME/.engram" \
  "$HOME/.config/opencode" \
  "$HOME/.gentle-ai" \
  "$HOME/.claude" \
  "$HOME/.local/share/opencode"; do
  if [ -e "$path" ]; then
    printf 'path=%s|present\n' "$path"
  else
    printf 'path=%s|absent\n' "$path"
  fi
done

printf 'secret-values=not-read\n'
printf 'mutations=none\n'
