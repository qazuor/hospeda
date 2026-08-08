#!/usr/bin/env bash
#
# HOS-377 T-030 — AC-3 copy guard for the partner mentions log.
#
# The mentions log records ACTIONS the team took, each with a link to verify it.
# Hospeda measures nothing about how those actions performed, so its copy may
# never speak of "alcance", "impresiones", "clics" or "estadísticas" — a partner
# who reads one of those words will ask for the number behind it.
#
# ## This is a CONVENIENCE ENTRY POINT, not where the guard runs
#
# The predicate lives in `packages/i18n/test/partner-mention-copy.guard.test.ts`,
# and that placement is deliberate rather than incidental: CI runs
# `turbo run test`, which reaches `@repo/i18n`'s suite, so the guard executes on
# every pull request from there.
#
# `pnpm check:guards` — which this script is registered in — is invoked by NO
# workflow and NO git hook. It appears exactly once in the whole repo, in
# `package.json`. A guard registered ONLY there never runs on a PR, which is
# precisely the trap this comment exists to stop the next person falling into.
#
# Usage: bash scripts/check-partner-mention-copy.sh
set -euo pipefail

echo "=== HOS-377 AC-3: partner-mentions copy guard ==="
echo
echo "Checking that no partner-mentions i18n string (admin + web, es/en/pt)"
echo "matches a banned metric word: alcance / impresiones / clics / estadísticas."
echo

pnpm --filter @repo/i18n exec vitest run test/partner-mention-copy.guard.test.ts

echo
echo "OK — no banned metric vocabulary in the partner-mentions namespaces."
