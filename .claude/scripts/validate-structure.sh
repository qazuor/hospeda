#!/bin/bash

# validate-structure.sh
# Validates the complete .claude directory structure

set -e

echo "🔍 Validating .claude directory structure..."
echo ""

ERRORS=0
WARNINGS=0

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

error() {
  echo -e "${RED}✗ $1${NC}"
  ERRORS=$((ERRORS + 1))
}

warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
  WARNINGS=$((WARNINGS + 1))
}

success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Check required directories
echo "📁 Checking directory structure..."

REQUIRED_DIRS=(
  ".claude/agents"
  ".claude/commands"
  ".claude/skills"
  ".claude/docs"
  ".claude/docs/standards"
  ".claude/docs/workflows"
  ".claude/docs/diagrams"
  ".claude/docs/learnings"
  ".claude/schemas"
  ".claude/scripts"
  ".claude/sessions"
  ".claude/sessions/planning"
)

for dir in "${REQUIRED_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    error "Missing directory: $dir"
  else
    success "Directory exists: $dir"
  fi
done

echo ""
echo "📄 Checking required files..."

REQUIRED_FILES=(
  "CLAUDE.md"
  ".claude/docs/INDEX.md"
  ".claude/docs/quick-start.md"
  ".claude/docs/glossary.md"
  ".claude/agents/README.md"
  ".claude/commands/README.md"
  ".claude/skills/README.md"
  ".claude/scripts/health-check.sh"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    error "Missing file: $file"
  else
    success "File exists: $file"
  fi
done

echo ""
echo "🔢 Checking file counts..."

# Count agents (excluding README.md)
AGENT_COUNT=$(find .claude/agents -name "*.md" -type f ! -name "README.md" | wc -l)
echo "   Agents: $AGENT_COUNT (expected: 13)"
if [ "$AGENT_COUNT" -ne 13 ]; then
  warning "Agent count mismatch"
fi

# Count commands (excluding README.md)
COMMAND_COUNT=$(find .claude/commands -name "*.md" -type f ! -name "README.md" | wc -l)
echo "   Commands: $COMMAND_COUNT (expected: 16)"
if [ "$COMMAND_COUNT" -ne 16 ]; then
  warning "Command count mismatch"
fi

# Count skills (excluding README.md)
SKILL_COUNT=$(find .claude/skills -name "*.md" -type f ! -name "README.md" | wc -l)
echo "   Skills: $SKILL_COUNT (expected: 16)"
if [ "$SKILL_COUNT" -ne 16 ]; then
  warning "Skill count mismatch"
fi

# Count workflows (excluding README.md)
WORKFLOW_COUNT=$(find .claude/docs/workflows -name "*.md" -type f ! -name "README.md" | wc -l)
echo "   Workflows: $WORKFLOW_COUNT (expected: 9)"
if [ "$WORKFLOW_COUNT" -ne 9 ]; then
  warning "Workflow count mismatch"
fi

# Count diagrams
DIAGRAM_COUNT=$(find .claude/docs/diagrams -name "*.mmd" -type f | wc -l)
echo "   Diagrams: $DIAGRAM_COUNT (expected: 4)"
if [ "$DIAGRAM_COUNT" -ne 4 ]; then
  warning "Diagram count mismatch"
fi

# Count learnings (excluding README.md)
LEARNING_COUNT=$(find .claude/docs/learnings -name "*.md" -type f ! -name "README.md" | wc -l)
echo "   Learnings: $LEARNING_COUNT (expected: 8)"
if [ "$LEARNING_COUNT" -ne 8 ]; then
  warning "Learning count mismatch"
fi

# Count schemas
SCHEMA_COUNT=$(find .claude/schemas -name "*.schema.json" -type f 2>/dev/null | wc -l)
echo "   Schemas: $SCHEMA_COUNT (expected: 7)"
if [ "$SCHEMA_COUNT" -ne 7 ]; then
  warning "Schema count mismatch"
fi

echo ""
echo "🔐 Checking script permissions..."

SCRIPTS=(
  ".claude/scripts/health-check.sh"
  ".claude/scripts/validate-structure.sh"
  ".claude/scripts/validate-docs.sh"
)

for script in "${SCRIPTS[@]}"; do
  if [ -f "$script" ]; then
    if [ -x "$script" ]; then
      success "Executable: $script"
    else
      warning "Not executable: $script (run: chmod +x $script)"
    fi
  fi
done

echo ""
echo "📊 Summary"
echo "=========="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  success "All structure validation checks passed!"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  warning "$WARNINGS warnings found"
  exit 0
else
  error "$ERRORS errors and $WARNINGS warnings found"
  exit 1
fi
