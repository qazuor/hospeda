#!/usr/bin/env bash
#
# HOS-377 T-030 — AC-3 copy guard for the partner mentions log.
#
# The mentions log records ACTIONS the team took, each with a link to verify it.
# Hospeda measures nothing about how those actions performed, so its copy may
# never speak of "alcance", "impresiones", "clics" or "estadísticas" — a partner
# who reads one of those words will ask for the number behind it.
#
# ## Where the predicate lives, and the three ways it runs
#
# The predicate is `packages/i18n/test/partner-mention-copy.guard.test.ts`. This
# script only delegates to it, so all entry points check exactly the same thing.
#
# It executes on a pull request TWICE, by two independent routes:
#   1. `turbo run test` reaches `@repo/i18n`'s suite directly.
#   2. The Guards job in `.github/workflows/ci.yml` has a step running this
#      script by path.
#
# ## The trap worth naming for the next guard
#
# That Guards job invokes every guard script INDIVIDUALLY (`bash scripts/…`,
# one step each) — it never calls `pnpm check:guards`. The aggregate exists for
# local use only and is invoked by no workflow and no git hook; it appears
# exactly once in the repo, in `package.json`.
#
# So: adding a script to `check:guards` does NOT put it in CI. The Guards job
# has to gain its own step as well, or the guard is green locally and absent
# from every pull request.
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
