#!/usr/bin/env bash
# Read-only staged-content guard. It never prints matching values.
set -euo pipefail

staged_files="$(git diff --cached --name-only --diff-filter=ACMR)"
[ -z "$staged_files" ] && exit 0

bad_names=0
while IFS= read -r file; do
  case "$file" in
    .env|.env.*|*.pem|*.key|*id_rsa*|*id_ed25519*|*.p12|*.pfx|*.dump|*.sql.gz)
      echo "secret guard: forbidden staged filename: $file" >&2
      bad_names=1
      ;;
  esac
done <<< "$staged_files"

# Inspect only added lines. Report rule names, never content.
patterns=(
  '-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'
  '(AKIA|ASIA)[0-9A-Z]{16}'
  '(ghp|github_pat|sk_live|sk_test|lin_api)_[A-Za-z0-9_-]{12,}'
  '(password|passwd|secret|token|api[_-]?key)[[:space:]]*=[[:space:]]*[^[:space:]]{8,}'
  'postgres(ql)?://[^[:space:]/]+:[^[:space:]@]+@'
)
bad_content=0
for pattern in "${patterns[@]}"; do
  matches="$(git diff --cached --diff-filter=ACMR -U0 -- \
    | grep -E '^\+[^+]' \
    | grep -Eio -- "$pattern" \
    | head -1 || true)"
  if [ -n "$matches" ]; then
    echo "secret guard: potential secret pattern detected (value hidden)" >&2
    bad_content=1
    break
  fi
done

if [ "$bad_names" -ne 0 ] || [ "$bad_content" -ne 0 ]; then
  echo "secret guard: review staged files; use --no-verify only for an approved fixture" >&2
  exit 1
fi

echo "secret guard: staged files clean"
