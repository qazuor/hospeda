#!/bin/bash

# validate-registry.sh
# Validates the code registry JSON file

set -e

echo "🔍 Validating code registry..."
echo ""

REGISTRY_FILE=".claude/sessions/planning/.code-registry.json"

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

error() {
  echo -e "${RED}✗ $1${NC}"
  exit 1
}

warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Check if registry file exists
if [ ! -f "$REGISTRY_FILE" ]; then
  error "Code registry not found: $REGISTRY_FILE"
fi

success "Code registry file exists"

# Validate JSON format
if ! jq empty "$REGISTRY_FILE" 2>/dev/null; then
  error "Code registry is not valid JSON"
fi

success "Code registry is valid JSON"

# Check required fields
VERSION=$(jq -r '.version // empty' "$REGISTRY_FILE")
if [ -z "$VERSION" ]; then
  error "Missing required field: version"
fi
success "Version field present: $VERSION"

LAST_NUMBER=$(jq -r '.lastPlanningNumber // empty' "$REGISTRY_FILE")
if [ -z "$LAST_NUMBER" ]; then
  error "Missing required field: lastPlanningNumber"
fi
success "Last planning number: $LAST_NUMBER"

# Count sessions
FEATURE_COUNT=$(jq '.features | length' "$REGISTRY_FILE")
REFACTOR_COUNT=$(jq '.refactors | length' "$REGISTRY_FILE")
BUGFIX_COUNT=$(jq '.bugfixes | length' "$REGISTRY_FILE")

echo ""
echo "📊 Registry Statistics"
echo "======================"
echo "   Features: $FEATURE_COUNT"
echo "   Refactors: $REFACTOR_COUNT"
echo "   Bugfixes: $BUGFIX_COUNT"
echo "   Total: $((FEATURE_COUNT + REFACTOR_COUNT + BUGFIX_COUNT))"

# Validate each session entry
echo ""
echo "🔍 Validating session entries..."

ERRORS=0

# Validate features
if [ "$FEATURE_COUNT" -gt 0 ]; then
  jq -r '.features | keys[]' "$REGISTRY_FILE" | while read -r code; do
    TYPE=$(jq -r ".features[\"$code\"].type" "$REGISTRY_FILE")
    TITLE=$(jq -r ".features[\"$code\"].title" "$REGISTRY_FILE")
    PATH=$(jq -r ".features[\"$code\"].sessionPath" "$REGISTRY_FILE")

    if [ "$TYPE" != "feature" ]; then
      warning "Feature $code has incorrect type: $TYPE"
    fi

    if [ -z "$TITLE" ] || [ "$TITLE" = "null" ]; then
      warning "Feature $code missing title"
    fi

    if [ -z "$PATH" ] || [ "$PATH" = "null" ]; then
      warning "Feature $code missing sessionPath"
    elif [ ! -d "$PATH" ]; then
      warning "Feature $code sessionPath doesn't exist: $PATH"
    fi

    success "Feature $code validated"
  done
fi

# Validate refactors
if [ "$REFACTOR_COUNT" -gt 0 ]; then
  jq -r '.refactors | keys[]' "$REGISTRY_FILE" | while read -r code; do
    TYPE=$(jq -r ".refactors[\"$code\"].type" "$REGISTRY_FILE")
    TITLE=$(jq -r ".refactors[\"$code\"].title" "$REGISTRY_FILE")
    PATH=$(jq -r ".refactors[\"$code\"].sessionPath" "$REGISTRY_FILE")

    if [ "$TYPE" != "refactor" ]; then
      warning "Refactor $code has incorrect type: $TYPE"
    fi

    success "Refactor $code validated"
  done
fi

# Check for staleness (> 7 days)
MODIFIED_DATE=$(stat -c %Y "$REGISTRY_FILE" 2>/dev/null || stat -f %m "$REGISTRY_FILE" 2>/dev/null)
CURRENT_DATE=$(date +%s)
DAYS_OLD=$(( (CURRENT_DATE - MODIFIED_DATE) / 86400 ))

echo ""
if [ $DAYS_OLD -gt 7 ]; then
  warning "Code registry is $DAYS_OLD days old (last modified: $(date -r $REGISTRY_FILE '+%Y-%m-%d'))"
  warning "Consider running sync-registry.sh to update"
else
  success "Code registry is up to date ($DAYS_OLD days old)"
fi

echo ""
echo "📊 Summary"
echo "=========="
success "Code registry validation complete"
echo "   Sessions: $((FEATURE_COUNT + REFACTOR_COUNT + BUGFIX_COUNT))"
echo "   Last planning number: $LAST_NUMBER"
echo "   Age: $DAYS_OLD days"

exit 0
