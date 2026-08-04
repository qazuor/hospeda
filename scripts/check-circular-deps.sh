#!/usr/bin/env bash
# check-circular-deps.sh
#
# Enforces the package layering rules of the Hospeda monorepo. Fails with a
# non-zero exit code if a package depends on one that sits above it.
#
# Prohibited rules:
#   1. @repo/db must NOT depend on @repo/service-core
#   2. @repo/schemas must NOT depend on @repo/db
#
# Each rule is checked on two independent layers, because either one alone
# leaves a hole:
#
#   Layer 1 — the package manifest. This is the real architectural
#   invariant: a package.json that declares the forbidden workspace
#   dependency. A manifest carries no prose, so this layer cannot produce a
#   false positive.
#
#   Layer 2 — the source imports. Catches an import that slipped in before
#   anyone touched the manifest (the resolution still works from the repo
#   root's hoisted node_modules). Only real import/export/require/dynamic-
#   import statements count — a package name mentioned inside a comment or
#   JSDoc block is documentation, not a dependency. Scope is each package's
#   src/ tree, which is the shipped surface.
#
# Usage:
#   bash scripts/check-circular-deps.sh
#
# CI integration:
#   Runs as a step of the `Guards` job in .github/workflows/ci.yml, and is
#   part of the `check:guards` aggregate in the root package.json.

set -euo pipefail

# Rules to enforce: "<consumer package dir>|<forbidden package name>"
RULES=(
    "packages/db|@repo/service-core"
    "packages/schemas|@repo/db"
)

FAIL=0
PASS_COUNT=0
CHECK_COUNT=0

echo "=== Checking package layering rules ==="

# ---------------------------------------------------------------------------
# Layer 1: does the manifest declare the forbidden dependency?
#
# Prints the dependency blocks that declare it and returns 0 on a violation,
# returns 1 when the manifest is clean.
# ---------------------------------------------------------------------------
manifest_declares() {
    local manifest="$1"
    local dep="$2"

    node -e '
        const { readFileSync } = require("node:fs");
        const [manifestPath, dep] = process.argv.slice(1);
        const pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
        const blocks = [
            "dependencies",
            "devDependencies",
            "peerDependencies",
            "optionalDependencies"
        ];
        const declaredIn = blocks.filter(
            (block) => pkg[block] && Object.hasOwn(pkg[block], dep)
        );
        if (declaredIn.length === 0) {
            process.exit(1);
        }
        console.log(declaredIn.join(", "));
    ' "$manifest" "$dep"
}

# ---------------------------------------------------------------------------
# Layer 2: does any source file import the forbidden package?
#
# Matches only statement forms that actually create a dependency:
#   import x from 'dep'   |   import 'dep'      |   export * from 'dep'
#   require('dep')        |   import('dep')     |   (plus any 'dep/subpath')
#
# Lines whose first non-space character starts a comment (`//`, `*`, `/*`)
# are dropped: a real import statement can never begin that way, so this
# cannot hide a violation, but it does keep JSDoc that merely NAMES the
# package from being reported as one.
# ---------------------------------------------------------------------------
find_real_imports() {
    local dir="$1"
    local dep="$2"

    grep -rnE --include="*.ts" --include="*.tsx" \
        "(from|import|require)[[:space:]]*\(?[[:space:]]*['\"]${dep}(/[^'\"]*)?['\"]" \
        "$dir" 2>/dev/null \
        | grep -vE "^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)" \
        || true
}

for rule in "${RULES[@]}"; do
    CONSUMER_DIR="${rule%%|*}"
    FORBIDDEN="${rule##*|}"
    CONSUMER_NAME="@repo/$(basename "$CONSUMER_DIR")"

    echo ""
    echo "$CONSUMER_NAME must NOT depend on $FORBIDDEN"

    # --- Layer 1 -----------------------------------------------------------
    CHECK_COUNT=$((CHECK_COUNT + 1))
    MANIFEST="$CONSUMER_DIR/package.json"

    if [ ! -f "$MANIFEST" ]; then
        echo "  ERROR: manifest not found: $MANIFEST"
        echo "         The rule cannot be enforced — fix the path in RULES."
        FAIL=1
    elif DECLARED_IN=$(manifest_declares "$MANIFEST" "$FORBIDDEN"); then
        echo "  ERROR: $MANIFEST declares $FORBIDDEN in: $DECLARED_IN"
        echo "         Remove the dependency — this is the wrong direction."
        FAIL=1
    else
        echo "  OK — manifest does not declare it."
        PASS_COUNT=$((PASS_COUNT + 1))
    fi

    # --- Layer 2 -----------------------------------------------------------
    CHECK_COUNT=$((CHECK_COUNT + 1))
    SRC_DIR="$CONSUMER_DIR/src"

    if [ ! -d "$SRC_DIR" ]; then
        echo "  ERROR: source directory not found: $SRC_DIR"
        echo "         The rule cannot be enforced — fix the path in RULES."
        FAIL=1
    else
        IMPORTS=$(find_real_imports "$SRC_DIR" "$FORBIDDEN")
        if [ -n "$IMPORTS" ]; then
            echo "  ERROR: $SRC_DIR imports $FORBIDDEN:"
            echo "    ${IMPORTS//$'\n'/$'\n'    }"
            echo "         Remove the import — this is the wrong direction."
            FAIL=1
        else
            echo "  OK — no source file imports it."
            PASS_COUNT=$((PASS_COUNT + 1))
        fi
    fi
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Results: $PASS_COUNT/$CHECK_COUNT checks passed ==="

if [ "$FAIL" -eq 1 ]; then
    echo "FAILED — fix the layering violations above before merging."
    exit 1
fi

echo "No layering violations found."
exit 0
