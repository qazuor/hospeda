#!/usr/bin/env bash
#
# Code Registry Validation Script
#
# Validates .code-registry.json against its JSON schema and checks data integrity
#
# Exit codes:
#   0 - Validation passed
#   1 - Validation failed
#

set -euo pipefail

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REGISTRY_FILE=".claude/sessions/planning/.code-registry.json"
SCHEMA_FILE=".claude/schemas/code-registry.schema.json"

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

info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

echo -e "${BLUE}🔍 Validating code registry...${NC}"
echo ""

# ============================================================================
# 1. Check file existence
# ============================================================================

if [ ! -f "$REGISTRY_FILE" ]; then
  error "Code registry not found: $REGISTRY_FILE"
fi

success "Registry file exists"

if [ ! -f "$SCHEMA_FILE" ]; then
  error "Schema file not found: $SCHEMA_FILE"
fi

success "Schema file exists"

# ============================================================================
# 2. Validate JSON syntax
# ============================================================================

if ! jq empty "$REGISTRY_FILE" 2>/dev/null; then
  error "Registry is not valid JSON"
fi

success "Registry is valid JSON"

# ============================================================================
# 3. Validate against JSON Schema (using Node + AJV)
# ============================================================================

echo ""
echo "📋 Validating against schema..."

# Create temporary validation script
TEMP_SCRIPT=$(mktemp)
cat > "$TEMP_SCRIPT" << 'EOF'
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');

const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

const schemaPath = process.argv[2];
const dataPath = process.argv[3];

try {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (!valid) {
    console.error('Schema validation failed:');
    console.error(JSON.stringify(validate.errors, null, 2));
    process.exit(1);
  }

  console.log('✓ Schema validation passed');
  process.exit(0);
} catch (error) {
  console.error('Validation error:', error.message);
  process.exit(1);
}
EOF

if node "$TEMP_SCRIPT" "$SCHEMA_FILE" "$REGISTRY_FILE" 2>/dev/null; then
  success "Schema validation passed"
else
  rm -f "$TEMP_SCRIPT"
  error "Schema validation failed"
fi

rm -f "$TEMP_SCRIPT"

# ============================================================================
# 4. Extract and display statistics
# ============================================================================

echo ""
echo "📊 Registry Statistics"
echo "======================"

VERSION=$(jq -r '.version' "$REGISTRY_FILE")
GENERATED_AT=$(jq -r '.generatedAt' "$REGISTRY_FILE")
LAST_PLANNING=$(jq -r '.lastPlanningNumber' "$REGISTRY_FILE")
TOTAL_SESSIONS=$(jq '.registry | length' "$REGISTRY_FILE")

echo "   Version: $VERSION"
echo "   Generated: $GENERATED_AT"
echo "   Last planning number: $LAST_PLANNING"
echo "   Total sessions: $TOTAL_SESSIONS"

# Count by type
FEATURE_COUNT=$(jq '[.registry[] | select(.type == "feature")] | length' "$REGISTRY_FILE")
REFACTOR_COUNT=$(jq '[.registry[] | select(.type == "refactor")] | length' "$REGISTRY_FILE")
BUGFIX_COUNT=$(jq '[.registry[] | select(.type == "bugfix")] | length' "$REGISTRY_FILE")

echo ""
echo "   By Type:"
echo "   ├─ Features: $FEATURE_COUNT"
echo "   ├─ Refactors: $REFACTOR_COUNT"
echo "   └─ Bugfixes: $BUGFIX_COUNT"

# Count by status
ACTIVE_COUNT=$(jq '[.registry[] | select(.status == "active")] | length' "$REGISTRY_FILE")
COMPLETED_COUNT=$(jq '[.registry[] | select(.status == "completed")] | length' "$REGISTRY_FILE")
ARCHIVED_COUNT=$(jq '[.registry[] | select(.status == "archived")] | length' "$REGISTRY_FILE")
CANCELLED_COUNT=$(jq '[.registry[] | select(.status == "cancelled")] | length' "$REGISTRY_FILE")

echo ""
echo "   By Status:"
echo "   ├─ Active: $ACTIVE_COUNT"
echo "   ├─ Completed: $COMPLETED_COUNT"
echo "   ├─ Archived: $ARCHIVED_COUNT"
echo "   └─ Cancelled: $CANCELLED_COUNT"

# Total tasks
TOTAL_TASKS=$(jq '[.registry[].tasks | length] | add // 0' "$REGISTRY_FILE")
echo ""
echo "   Total tasks: $TOTAL_TASKS"

# ============================================================================
# 5. Validate session paths exist
# ============================================================================

echo ""
echo "🔍 Validating session paths..."

MISSING_PATHS=0
jq -r '.registry[].sessionPath' "$REGISTRY_FILE" | while read -r path; do
  SESSION_PATH=".claude/sessions/planning/$path"
  if [ ! -d "$SESSION_PATH" ]; then
    warning "Session path not found: $path"
    ((MISSING_PATHS++))
  fi
done

if [ "$MISSING_PATHS" -eq 0 ]; then
  success "All session paths exist"
fi

# ============================================================================
# 6. Check staleness
# ============================================================================

echo ""
echo "⏰ Checking freshness..."

CURRENT_TIME=$(date +%s)
GENERATED_TIME=$(date -d "$GENERATED_AT" +%s 2>/dev/null || echo "0")

if [ "$GENERATED_TIME" -gt 0 ]; then
  TIME_DIFF=$((CURRENT_TIME - GENERATED_TIME))
  DAYS_OLD=$((TIME_DIFF / 86400))

  if [ $DAYS_OLD -gt 7 ]; then
    warning "Registry is $DAYS_OLD days old - consider regenerating"
    info "Run: pnpm claude:sync:registry"
  else
    success "Registry is fresh ($DAYS_OLD days old)"
  fi
else
  warning "Could not determine registry age"
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
success "Code registry validation complete"
echo ""
echo "   Sessions: $TOTAL_SESSIONS ($ACTIVE_COUNT active)"
echo "   Tasks: $TOTAL_TASKS"
echo "   Last planning: $LAST_PLANNING"
echo ""

exit 0
