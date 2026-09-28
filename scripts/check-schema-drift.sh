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
# Fail-closed (HOS-1130): drizzle-kit does NOT reliably signal failure through
# its exit code. On a snapshot-lineage collision it prints `Error: ... which is
# a collision`, writes nothing and exits 0 — which used to look exactly like
# "no drift". So exit 0 plus an empty `git status` proves nothing. This script
# therefore reads the CONTENT of the generate log and only certifies "No drift"
# on POSITIVE evidence that the diff was computed (drizzle-kit's own
# "No schema changes, nothing to migrate" line). It fails on: a non-zero exit,
# an `Error:` line in the output, an empty log, or a log with neither drift
# nor the no-changes confirmation.
#
# Test seams (used only by scripts/__tests__/check-schema-drift.test.ts):
#   SCHEMA_DRIFT_REPO_ROOT     - repo root override (a scratch git repo)
#   SCHEMA_DRIFT_GENERATE_CMD  - command run instead of the real drizzle-kit
#
# Exit codes: 0 = no drift (positively confirmed); 1 = drift detected, generate
# failed, or the comparison could not be confirmed to have run.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${SCHEMA_DRIFT_REPO_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
MIGRATIONS_DIR="packages/db/src/migrations"
# The line drizzle-kit prints when it compared the schema and found nothing to do.
NO_CHANGES_MARKER="No schema changes, nothing to migrate"

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
run_generate() {
    if [[ -n "${SCHEMA_DRIFT_GENERATE_CMD:-}" ]]; then
        bash -c "${SCHEMA_DRIFT_GENERATE_CMD}"
    else
        echo "" | pnpm --filter @repo/db run drizzle-kit generate \
            --config drizzle.config.ts --name drift_check
    fi
}

revert_generated() {
    git checkout -- "${MIGRATIONS_DIR}" 2>/dev/null || true
    git clean -fd -- "${MIGRATIONS_DIR}" >/dev/null 2>&1 || true
}

if ! run_generate >"${GEN_LOG}" 2>&1; then
    echo "[schema-drift] ❌ drizzle-kit generate failed:"
    cat "${GEN_LOG}"
    # Clean up anything it may have written before failing.
    revert_generated
    exit 1
fi

DRIFT="$(git status --porcelain -- "${MIGRATIONS_DIR}")"

# Always revert the throwaway generated files so the tree is clean.
revert_generated

# drizzle-kit can print an error and still exit 0 (snapshot collision, HOS-1130).
# Inspect the output itself, before trusting an empty `git status`.
if grep -q 'Error:' "${GEN_LOG}"; then
    echo "[schema-drift] ❌ drizzle-kit reported an error but exited 0 — the schema"
    echo "               comparison did NOT run, so this is NOT a 'no drift' result:"
    cat "${GEN_LOG}"
    exit 1
fi

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

# No drift files: only certify if drizzle-kit positively confirmed it compared.
if ! grep -qF "${NO_CHANGES_MARKER}" "${GEN_LOG}"; then
    echo "[schema-drift] ❌ Cannot certify 'no drift': drizzle-kit wrote no migration but"
    echo "               also never printed \"${NO_CHANGES_MARKER}\"."
    echo "               The comparison is not proven to have run. Output was:"
    if [[ -s "${GEN_LOG}" ]]; then cat "${GEN_LOG}"; else echo "               (empty)"; fi
    exit 1
fi

echo "[schema-drift] ✓ No drift — the TS schema matches the committed migrations."
