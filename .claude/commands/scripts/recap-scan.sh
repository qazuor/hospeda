#!/usr/bin/env bash
# recap-scan.sh — local-only sweep of every git worktree, for the /recap command.
#
# Emits one TSV row per worktree so the agent can build the candidate list
# without spending a round-trip per worktree. Purely local: no network, no gh,
# no Linear. Read-only — it never writes to any repository.
#
# Usage:  bash recap-scan.sh [repo-path]
#         repo-path defaults to the current directory.
#
# Output: a header line starting with '#', then one TSV row per worktree:
#   idx  current  path  wt_issue  branch  issue  base  ahead  unpushed  dirty  age  last_subject
#
# Field semantics:
#   current      "*" when this is the worktree the script was invoked from
#   wt_issue     tracker id parsed from the worktree DIRECTORY name, or "-"
#   issue        tracker id parsed from the BRANCH name, or "-". When wt_issue
#                and issue disagree, the worktree was recycled for other work
#                and the branch is the one telling the truth.
#   base         integration branch the worktree is compared against
#   ahead        commits on this branch not in base ("-" when base is unknown)
#   unpushed     commits not in the branch's upstream ("-" when no upstream)
#   dirty        count of modified/untracked paths in the working tree
#   age          relative date of the last commit
#   last_subject subject line of the last commit

set -uo pipefail

REPO_PATH="${1:-$PWD}"
INVOKED_FROM="$(cd "$REPO_PATH" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null || echo "")"

# Pick the integration branch this repo actually uses, most specific first.
resolve_base() {
    local wt="$1" candidate
    for candidate in origin/staging origin/main origin/master staging main master; do
        if git -C "$wt" rev-parse --verify --quiet "$candidate" >/dev/null 2>&1; then
            printf '%s' "$candidate"
            return 0
        fi
    done
    printf '%s' "-"
}

# Tracker ids look like HOS-123 / BETA-45 / SPEC-278 anywhere in the branch name.
parse_issue() {
    printf '%s' "$1" | grep -oiE '\b[a-z]+-[0-9]+\b' | head -1 | tr '[:lower:]' '[:upper:]' || true
}

count_or_dash() {
    local value
    value="$(eval "$1" 2>/dev/null)" || value=""
    printf '%s' "${value:--}"
}

printf '#idx\tcurrent\tpath\twt_issue\tbranch\tissue\tbase\tahead\tunpushed\tdirty\tage\tlast_subject\n'

idx=0
while IFS= read -r wt_path; do
    [ -n "$wt_path" ] || continue
    idx=$((idx + 1))

    if [ ! -d "$wt_path" ]; then
        printf '%s\t\t%s\t%s\tMISSING\t-\t-\t-\t-\t-\t-\tworktree path does not exist (prunable)\n' \
            "$idx" "$wt_path" "$(parse_issue "$(basename "$wt_path")" || echo '-')"
        continue
    fi

    branch="$(git -C "$wt_path" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
    [ "$branch" = "HEAD" ] && branch="(detached)"

    issue="$(parse_issue "$branch")"
    wt_issue="$(parse_issue "$(basename "$wt_path")")"
    base="$(resolve_base "$wt_path")"

    if [ "$base" != "-" ] && [ "$branch" != "(detached)" ]; then
        ahead="$(git -C "$wt_path" rev-list --count "${base}..HEAD" 2>/dev/null || echo '-')"
    else
        ahead="-"
    fi

    if git -C "$wt_path" rev-parse --abbrev-ref '@{upstream}' >/dev/null 2>&1; then
        unpushed="$(git -C "$wt_path" rev-list --count '@{upstream}..HEAD' 2>/dev/null || echo '-')"
    else
        unpushed="none"
    fi

    dirty="$(git -C "$wt_path" status --porcelain 2>/dev/null | grep -c . || true)"
    age="$(git -C "$wt_path" log -1 --format='%cr' 2>/dev/null || echo '-')"
    subject="$(git -C "$wt_path" log -1 --format='%s' 2>/dev/null | tr '\t' ' ' || echo '-')"

    current=""
    [ -n "$INVOKED_FROM" ] && [ "$wt_path" = "$INVOKED_FROM" ] && current="*"

    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
        "$idx" "$current" "$wt_path" "${wt_issue:--}" "$branch" "${issue:--}" \
        "$base" "$ahead" "$unpushed" "${dirty:-0}" "$age" "$subject"
done < <(git -C "$REPO_PATH" worktree list --porcelain 2>/dev/null | awk '/^worktree /{print substr($0, 10)}')

if [ "$idx" -eq 0 ]; then
    printf '# no worktrees found (is %s inside a git repository?)\n' "$REPO_PATH" >&2
    exit 1
fi
