#!/usr/bin/env bash
# check-circular-deps.sh
#
# Enforces architectural dependency rules for the Hospeda monorepo.
# Fails with a non-zero exit code if any prohibited import is found.
#
# Prohibited rules:
#   1. @repo/db must NOT import from @repo/service-core
#   2. @repo/schemas must NOT import from @repo/db
#
# Usage:
#   bash scripts/check-circular-deps.sh
#
# CI integration:
#   Add "check:circular" to the tasks that must pass before merging.
#   See turbo.json for how to add a new task.

set -euo pipefail

ERRORS=0

# Rule 1: @repo/db must NOT import from @repo/service-core
if rg --type ts '@repo/service-core' packages/db/src/ -l 2>/dev/null | grep -q .; then
    echo "ERROR: @repo/db imports from @repo/service-core (circular dependency)"
    rg --type ts '@repo/service-core' packages/db/src/ -l
    ERRORS=$((ERRORS + 1))
fi

# Rule 2: @repo/schemas must NOT import from @repo/db
if rg --type ts '@repo/db' packages/schemas/src/ -l 2>/dev/null | grep -q .; then
    echo "ERROR: @repo/schemas imports from @repo/db (circular dependency)"
    rg --type ts '@repo/db' packages/schemas/src/ -l
    ERRORS=$((ERRORS + 1))
fi

if [ $ERRORS -gt 0 ]; then
    echo ""
    echo "Found $ERRORS circular dependency violation(s). Fix the imports above before proceeding."
    exit 1
fi

echo "No circular dependency violations found."
exit 0
