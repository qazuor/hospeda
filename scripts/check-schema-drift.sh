#!/usr/bin/env bash
# =============================================================================
# check-schema-drift.sh  (SPEC-178)
#
# Fails if the Drizzle TS schema has changed without a committed migration.
#
# How: runs `drizzle-kit generate` OFFLINE (it diffs the TS schema against the
# committed journal snapshot — no DB connection needed). If it would emit a new
# migration (i.e. a non-empty `git status` under packages/db/src/migrations/),
# the schema and the versioned carril are out of sync, and CI fails with an
# actionable message. The throwaway generated files are reverted so the working
# tree is left clean either way.
#
# This is the guardrail that makes drift IMPOSSIBLE to merge: you cannot change
# a *.dbschema.ts without committing the migration `drizzle-kit generate`
# produces for it.
#
# Usage (local or CI):
#   bash scripts/check-schema-drift.sh
#
# Exit codes: 0 = no drift; 1 = drift detected (or generate failed).
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MIGRATIONS_DIR="packages/db/src/migrations"

cd "${REPO_ROOT}"

# Guard precondition: the migrations dir must start clean, otherwise a real
# in-progress migration would look like drift. CI checks out a clean tree, so
# this only bites local misuse.
PREEXISTING="$(git status --porcelain -- "${MIGRATIONS_DIR}")"
if [[ -n "${PREEXISTING}" ]]; then
    echo "[schema-drift] ⚠  ${MIGRATIONS_DIR} has uncommitted changes before the check:"
    echo "${PREEXISTING}"
    echo "[schema-drift] Commit or stash them first — cannot distinguish them from drift."
    exit 1
fi

echo "[schema-drift] Running drizzle-kit generate (offline, no DB)..."
GEN_LOG="$(mktemp)"
trap 'rm -f "${GEN_LOG}"' EXIT

# `--name` keeps the filename non-interactive; empty stdin prevents any rename
# prompt from hanging a non-TTY CI run.
if ! echo "" | pnpm --filter @repo/db run drizzle-kit generate \
        --config drizzle.config.ts --name drift_check >"${GEN_LOG}" 2>&1; then
    echo "[schema-drift] ❌ drizzle-kit generate failed:"
    cat "${GEN_LOG}"
    # Clean up anything it may have written before failing.
    git checkout -- "${MIGRATIONS_DIR}" 2>/dev/null || true
    git clean -fd -- "${MIGRATIONS_DIR}" >/dev/null 2>&1 || true
    exit 1
fi

DRIFT="$(git status --porcelain -- "${MIGRATIONS_DIR}")"

# Always revert the throwaway generated files so the tree is clean.
git checkout -- "${MIGRATIONS_DIR}" 2>/dev/null || true
git clean -fd -- "${MIGRATIONS_DIR}" >/dev/null 2>&1 || true

if [[ -n "${DRIFT}" ]]; then
    echo "[schema-drift] ❌ Schema drift detected — the TS schema changed but no"
    echo "               migration was committed. drizzle-kit generate would emit:"
    echo "${DRIFT}"
    echo ""
    echo "  Fix: run  pnpm --filter @repo/db db:generate"
    echo "       review the generated migration (add USING for any data conversion),"
    echo "       and commit it under ${MIGRATIONS_DIR}/."
    exit 1
fi

echo "[schema-drift] ✓ No drift — the TS schema matches the committed migrations."
