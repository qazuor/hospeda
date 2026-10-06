#!/usr/bin/env bash
# TEST:U1:7 — GUARD:G8 (scoped to root guidance, i18n, other specs, and .qtm).
set -euo pipefail

word='comm''erce'
violations=0

echo '=== Checking retired grouping word in scoped tracked files (TEST:U1:7, GUARD:G8) ==='
while IFS= read -r -d '' file; do
    case "$file" in
        CLAUDE.md|packages/i18n/*|.specs/*|.qtm/*) ;;
        *) continue ;;
    esac
    case "$file" in
        .specs/HOS-1352-*|.specs/HOS-1353-*|.specs/HOS-1354-*) continue ;;
    esac
    [[ -f "$file" ]] || continue
    if [[ "${file,,}" == *"$word"* ]] || grep -i -q -- "$word" "$file"; then
        echo "  ERROR: $file"
        violations=$((violations + 1))
    fi
done < <(git ls-files -z)

if [[ "$violations" -gt 0 ]]; then
    echo "ERROR: $violations offending file(s)."
    exit 1
fi
echo 'All checks passed.'
exit 0
