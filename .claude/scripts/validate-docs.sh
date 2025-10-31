#!/usr/bin/env bash
#
# Documentation Validation Script
#
# Validates:
# - Agent/command/skill counts match documentation
# - No broken internal links
# - File structure consistency
#
# Exit codes:
#   0 - All validations passed
#   1 - Validation failed
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0

# Base directories
CLAUDE_DIR=".claude"
AGENTS_DIR="${CLAUDE_DIR}/agents"
COMMANDS_DIR="${CLAUDE_DIR}/commands"
SKILLS_DIR="${CLAUDE_DIR}/skills"
DOCS_DIR="${CLAUDE_DIR}/docs"

echo "🔍 Validating documentation structure..."
echo ""

# ============================================================================
# 1. Count agents, commands, and skills
# ============================================================================

echo "📊 Counting components..."

# Count agents (excluding README.md and index files)
AGENT_COUNT=$(find "${AGENTS_DIR}" -type f -name "*.md" ! -name "README.md" ! -name "index.md" | wc -l)
echo "  Agents: ${AGENT_COUNT}"

# Count commands (excluding README.md and index files)
COMMAND_COUNT=$(find "${COMMANDS_DIR}" -type f -name "*.md" ! -name "README.md" ! -name "index.md" | wc -l)
echo "  Commands: ${COMMAND_COUNT}"

# Count skills (excluding README.md and index files)
SKILL_COUNT=$(find "${SKILLS_DIR}" -type f -name "*.md" ! -name "README.md" ! -name "index.md" | wc -l)
echo "  Skills: ${SKILL_COUNT}"

echo ""

# ============================================================================
# 2. Validate agent README matches actual count
# ============================================================================

echo "🤖 Validating agents..."

if [ -f "${AGENTS_DIR}/README.md" ]; then
  # Extract count from README Statistics section (looking for "**Total Agents**: 13")
  README_AGENT_COUNT=$(grep -oP '\*\*Total Agents\*\*: \K\d+' "${AGENTS_DIR}/README.md" || echo "0")

  if [ "${AGENT_COUNT}" -ne "${README_AGENT_COUNT}" ]; then
    echo -e "  ${RED}✗${NC} Agent count mismatch!"
    echo "    README says: ${README_AGENT_COUNT}"
    echo "    Actual count: ${AGENT_COUNT}"
    ((ERRORS++))
  else
    echo -e "  ${GREEN}✓${NC} Agent count matches (${AGENT_COUNT})"
  fi
else
  echo -e "  ${YELLOW}⚠${NC} agents/README.md not found"
  ((WARNINGS++))
fi

# ============================================================================
# 3. Validate command README matches actual count
# ============================================================================

echo "⚙️  Validating commands..."

if [ -f "${COMMANDS_DIR}/README.md" ]; then
  # Extract count from README (looking for "## Total: 18 Commands")
  README_COMMAND_COUNT=$(grep -oP '## Total: \K\d+(?= Commands)' "${COMMANDS_DIR}/README.md" || echo "0")

  if [ "${COMMAND_COUNT}" -ne "${README_COMMAND_COUNT}" ]; then
    echo -e "  ${RED}✗${NC} Command count mismatch!"
    echo "    README says: ${README_COMMAND_COUNT}"
    echo "    Actual count: ${COMMAND_COUNT}"
    ((ERRORS++))
  else
    echo -e "  ${GREEN}✓${NC} Command count matches (${COMMAND_COUNT})"
  fi
else
  echo -e "  ${YELLOW}⚠${NC} commands/README.md not found"
  ((WARNINGS++))
fi

# ============================================================================
# 4. Validate skill README matches actual count
# ============================================================================

echo "🎯 Validating skills..."

if [ -f "${SKILLS_DIR}/README.md" ]; then
  # Extract count from README (looking for "## Total: 16 Skills")
  README_SKILL_COUNT=$(grep -oP '## Total: \K\d+(?= Skills)' "${SKILLS_DIR}/README.md" || echo "0")

  if [ "${SKILL_COUNT}" -ne "${README_SKILL_COUNT}" ]; then
    echo -e "  ${RED}✗${NC} Skill count mismatch!"
    echo "    README says: ${README_SKILL_COUNT}"
    echo "    Actual count: ${SKILL_COUNT}"
    ((ERRORS++))
  else
    echo -e "  ${GREEN}✓${NC} Skill count matches (${SKILL_COUNT})"
  fi
else
  echo -e "  ${YELLOW}⚠${NC} skills/README.md not found"
  ((WARNINGS++))
fi

# ============================================================================
# 5. Check for broken internal links
# ============================================================================

echo ""
echo "🔗 Checking for broken internal links..."

# Find all markdown files in .claude
BROKEN_LINKS=0

while IFS= read -r file; do
  # Extract markdown links: [text](path)
  while IFS= read -r link; do
    # Skip external links (http://, https://, mailto:)
    if [[ "$link" =~ ^(http://|https://|mailto:) ]]; then
      continue
    fi

    # Skip anchors within same file
    if [[ "$link" =~ ^# ]]; then
      continue
    fi

    # Get directory of current file
    file_dir=$(dirname "$file")

    # Resolve relative path
    if [[ "$link" =~ ^/ ]]; then
      # Absolute path from repo root
      target_file="${link#/}"
    else
      # Relative path
      target_file="${file_dir}/${link}"
    fi

    # Remove anchor if present
    target_file="${target_file%%#*}"

    # Check if file exists
    if [ ! -f "$target_file" ] && [ ! -d "$target_file" ]; then
      echo -e "  ${RED}✗${NC} Broken link in ${file}"
      echo "    → ${link}"
      ((BROKEN_LINKS++))
      ((ERRORS++))
    fi
  done < <(grep -oP '\]\(\K[^)]+' "$file" 2>/dev/null || true)
done < <(find "${CLAUDE_DIR}" -type f -name "*.md")

if [ "${BROKEN_LINKS}" -eq 0 ]; then
  echo -e "  ${GREEN}✓${NC} No broken links found"
fi

# ============================================================================
# 6. Validate directory structure
# ============================================================================

echo ""
echo "📁 Validating directory structure..."

REQUIRED_DIRS=(
  "${AGENTS_DIR}"
  "${COMMANDS_DIR}"
  "${SKILLS_DIR}"
  "${DOCS_DIR}"
  "${CLAUDE_DIR}/schemas"
  "${CLAUDE_DIR}/scripts"
  "${CLAUDE_DIR}/sessions/planning"
)

for dir in "${REQUIRED_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    echo -e "  ${RED}✗${NC} Missing directory: ${dir}"
    ((ERRORS++))
  fi
done

echo -e "  ${GREEN}✓${NC} All required directories exist"

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "${ERRORS}" -eq 0 ]; then
  echo -e "${GREEN}✅ All validations passed!${NC}"
  if [ "${WARNINGS}" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  ${WARNINGS} warning(s)${NC}"
  fi
  exit 0
else
  echo -e "${RED}❌ Validation failed with ${ERRORS} error(s)${NC}"
  if [ "${WARNINGS}" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  ${WARNINGS} warning(s)${NC}"
  fi
  exit 1
fi
