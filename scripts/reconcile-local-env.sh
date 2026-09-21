#!/usr/bin/env bash
# Reconcile ignored local env files with the current checked-in templates.
#
# This intentionally never prints values. Existing assignments win; missing
# required assignments come from the template; optional template entries stay
# commented. Keys no longer present in a template are removed.
set -euo pipefail

ROOT="${1:-$(git rev-parse --show-toplevel)}"
ROOT="$(cd "$ROOT" && pwd -P)"

reconcile() {
    local rel="$1" local_file="$ROOT/$1" example_file
    case "$rel" in
        *.env.local) example_file="$ROOT/${rel%.local}.example" ;;
        *.env) example_file="$ROOT/${rel}.example" ;;
        *) return 0 ;;
    esac
    [[ -f "$example_file" ]] || return 0
    mkdir -p "$(dirname "$local_file")"
    local tmp
    tmp="$(mktemp "${local_file}.reconcile.XXXXXX")"
    if [[ -f "$local_file" ]]; then
        awk -v src="$local_file" -v ex="$example_file" '
            function key(s, t) {
                t=s; sub(/^[[:space:]#]*/, "", t)
                if (t !~ /^[A-Za-z_][A-Za-z0-9_]*=/) return ""
                sub(/=.*/, "", t); return t
            }
            BEGIN {
                while ((getline line < src) > 0) {
                    k=key(line)
                    if (k != "" && !source[k]++) sourceLine[k]=line
                }
                close(src)
                while ((getline line < ex) > 0) {
                    k=key(line)
                    if (k == "" || emitted[k]++) continue
                    if (k in sourceLine) print sourceLine[k]
                    else print line
                }
                close(ex); exit
            }
        ' "$example_file" "$local_file" > "$tmp"
        chmod --reference="$local_file" "$tmp" 2>/dev/null || true
    else
        cp -p "$example_file" "$tmp"
    fi
    mv "$tmp" "$local_file"
}

reconcile apps/api/.env.local
reconcile apps/web/.env.local
reconcile apps/admin/.env.local
reconcile docker/.env
printf '%s\n' 'local env reconciled against current templates (values hidden)'
