#!/usr/bin/env bash
#
# check-env-registry.sh — verify that every env var declared in any app's
# Zod schema has a matching entry in `@repo/config`'s ENV_REGISTRY (and
# vice-versa, modulo documented gaps).
#
# Runs the three per-app cross-validation tests introduced by SPEC-090
# (Option C). Each test imports its app's Zod schema directly and compares
# `.shape` keys against the registry — no manual mirror to maintain.
#
# Also runs the build-stage gate (I4): every Docker `ARG` in an app Dockerfile
# must have a registry entry, so build-time inputs are tracked too (not just the
# runtime Zod schemas).
#
# Usage:
#   pnpm env:check:registry
#
# Exit codes:
#   0 — every var is declared and registered (with documented exceptions)
#   non-zero — schema/registry drift detected; output names the offending var

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT"

echo "→ Checking API schema ↔ registry..."
pnpm --filter hospeda-api test test/utils/env-registry-cross-validation.test.ts

echo
echo "→ Checking Admin schema ↔ registry..."
pnpm --filter admin test test/env-registry-cross-validation.test.ts

echo
echo "→ Checking Web schema ↔ registry..."
pnpm --filter hospeda-web test test/lib/env-registry-cross-validation.test.ts

echo
echo "→ Checking Dockerfile build ARGs ↔ registry..."
pnpm --filter @repo/config test src/__tests__/dockerfile-build-args.test.ts

echo
echo "✓ All env schemas (runtime + build ARGs) are in sync with @repo/config's ENV_REGISTRY"
