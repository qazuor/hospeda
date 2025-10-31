#!/usr/bin/env bash
#
# Code Registry Sync Script
#
# Regenerates .code-registry.json from all TODOs.md files in planning sessions.
# This ensures the registry stays in sync with the source of truth (TODOs.md).
#
# Exit codes:
#   0 - Registry synced successfully
#   1 - Sync failed
#

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Syncing code registry from TODOs.md files...${NC}"
echo ""

# Check if generate-code-registry script exists
if [ ! -f ".claude/scripts/generate-code-registry.ts" ]; then
  echo "❌ Error: .claude/scripts/generate-code-registry.ts not found"
  exit 1
fi

# Run the registry generator
if tsx .claude/scripts/generate-code-registry.ts; then
  echo ""
  echo -e "${GREEN}✅ Code registry synced successfully!${NC}"
  echo -e "${YELLOW}💡 Registry file: .claude/sessions/planning/.code-registry.json${NC}"
  exit 0
else
  echo ""
  echo "❌ Failed to sync code registry"
  exit 1
fi
