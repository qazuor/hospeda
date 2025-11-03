#!/bin/bash
# Health Check System for Hospeda Project
# Validates system integrity and configuration
#
# Exit codes:
#   0 - All checks passed
#   1 - Warnings detected (non-critical issues)
#   2 - Errors detected (critical issues)

set -e  # Exit on error (except for checks)

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0
CHECKS=0

# Helper functions
error() {
  echo -e "${RED}❌ ERROR: $1${NC}"
  ERRORS=$((ERRORS + 1))
}

warning() {
  echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
  WARNINGS=$((WARNINGS + 1))
}

success() {
  echo -e "${GREEN}✅ $1${NC}"
}

info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

check_start() {
  CHECKS=$((CHECKS + 1))
  echo -e "\n${BLUE}━━━ Check $CHECKS: $1 ━━━${NC}"
}

# Change to project root
cd "$(dirname "$0")/../.."

echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Hospeda System Health Check v1.0         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo "🔍 Running comprehensive system health checks..."
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check 1: File Counts
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
check_start "File Counts"

agent_count=$(find .claude/agents -name "*.md" -type f ! -name "README.md" 2>/dev/null | wc -l)
command_count=$(find .claude/commands -name "*.md" -type f ! -name "README.md" 2>/dev/null | wc -l)
skill_count=$(find .claude/skills -name "*.md" -type f ! -name "README.md" 2>/dev/null | wc -l)
learning_count=$(find .claude/docs/learnings -name "*.md" -type f ! -name "README.md" 2>/dev/null | wc -l)
workflow_count=$(find .claude/docs/workflows -name "*.md" -type f ! -name "README.md" 2>/dev/null | wc -l)
diagram_count=$(find .claude/docs/diagrams -name "*.mmd" -type f 2>/dev/null | wc -l)

echo "📊 System component counts:"
echo "   Agents: $agent_count (expected: 15)"
echo "   Commands: $command_count (expected: 23)"
echo "   Skills: $skill_count (expected: 19)"
echo "   Learnings: $learning_count (expected: 8)"
echo "   Workflows: $workflow_count (expected: 10)"
echo "   Diagrams: $diagram_count (expected: 4)"

# Validate counts
ALL_COUNTS_MATCH=true

if [ "$agent_count" -ne 15 ]; then
  error "Agent count mismatch: found $agent_count, expected 15"
  ALL_COUNTS_MATCH=false
fi

if [ "$command_count" -ne 23 ]; then
  error "Command count mismatch: found $command_count, expected 23"
  ALL_COUNTS_MATCH=false
fi

if [ "$skill_count" -ne 19 ]; then
  error "Skill count mismatch: found $skill_count, expected 19"
  ALL_COUNTS_MATCH=false
fi

if [ "$learning_count" -ne 8 ]; then
  error "Learning count mismatch: found $learning_count, expected 8"
  ALL_COUNTS_MATCH=false
fi

if [ "$workflow_count" -ne 10 ]; then
  warning "Workflow count mismatch: found $workflow_count, expected 10"
  ALL_COUNTS_MATCH=false
fi

if [ "$diagram_count" -ne 4 ]; then
  warning "Diagram count mismatch: found $diagram_count, expected 4"
  ALL_COUNTS_MATCH=false
fi

if [ "$ALL_COUNTS_MATCH" = true ]; then
  success "All file counts match expected values"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check 2: Code Registry
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
check_start "Code Registry"

REGISTRY_FILE=".claude/sessions/planning/.code-registry.json"

if [ ! -f "$REGISTRY_FILE" ]; then
  warning "Code registry not found at $REGISTRY_FILE"
  info "Run 'pnpm planning:sync <session-path>' to generate it"
else
  # Validate JSON
  if ! jq empty "$REGISTRY_FILE" 2>/dev/null; then
    error "Code registry is not valid JSON"
  else
    TOTAL_SESSIONS=$(jq '.plannings | length // 0' "$REGISTRY_FILE" 2>/dev/null || echo "0")
    TOTAL_TASKS=$(jq '[.plannings[]] | add // 0' "$REGISTRY_FILE" 2>/dev/null || echo "0")
    GENERATED_AT=$(jq -r '.generatedAt // "unknown"' "$REGISTRY_FILE" 2>/dev/null || echo "unknown")

    echo "   Sessions: $TOTAL_SESSIONS"
    echo "   Tasks: $TOTAL_TASKS"
    echo "   Last updated: $GENERATED_AT"

    # Check staleness (7 days)
    if [ "$GENERATED_AT" != "unknown" ]; then
      CURRENT_TIME=$(date +%s)
      REGISTRY_TIME=$(date -d "$GENERATED_AT" +%s 2>/dev/null || echo "0")
      TIME_DIFF=$((CURRENT_TIME - REGISTRY_TIME))
      DAYS_OLD=$((TIME_DIFF / 86400))

      if [ $DAYS_OLD -gt 7 ]; then
        warning "Code registry is $DAYS_OLD days old (consider updating)"
      else
        success "Code registry is valid and up-to-date"
      fi
    fi
  fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check 3: Git Hooks Configuration
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
check_start "Git Hooks"

HOOKS_CONFIGURED=0

if [ -d ".husky" ]; then
  echo "📁 Husky directory found"

  # Check for required hooks
  if [ -f ".husky/pre-commit" ] && [ -x ".husky/pre-commit" ]; then
    echo "   ✓ pre-commit hook configured"
    HOOKS_CONFIGURED=$((HOOKS_CONFIGURED + 1))
  else
    warning "pre-commit hook missing or not executable"
  fi

  if [ -f ".husky/commit-msg" ] && [ -x ".husky/commit-msg" ]; then
    echo "   ✓ commit-msg hook configured"
    HOOKS_CONFIGURED=$((HOOKS_CONFIGURED + 1))
  else
    warning "commit-msg hook missing or not executable"
  fi

  if [ -f ".husky/post-checkout" ] && [ -x ".husky/post-checkout" ]; then
    echo "   ✓ post-checkout hook configured"
    HOOKS_CONFIGURED=$((HOOKS_CONFIGURED + 1))
  else
    warning "post-checkout hook missing or not executable"
  fi

  if [ -f ".huskyrc" ]; then
    echo "   ✓ .huskyrc configuration found"
  else
    warning ".huskyrc configuration file not found"
  fi

  if [ $HOOKS_CONFIGURED -eq 3 ]; then
    success "All Git hooks properly configured"
  else
    warning "Only $HOOKS_CONFIGURED/3 hooks configured"
  fi
else
  error "Husky not configured (.husky directory missing)"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check 4: Core Documentation Files
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
check_start "Core Documentation"

REQUIRED_FILES=(
  "CLAUDE.md"
  ".claude/docs/INDEX.md"
  ".claude/docs/quick-start.md"
  ".claude/docs/glossary.md"
  ".claude/docs/RECOMMENDED-HOOKS.md"
  ".claude/agents/README.md"
  ".claude/commands/README.md"
  ".claude/skills/README.md"
  ".claude/docs/workflows/README.md"
  ".claude/docs/learnings/README.md"
  ".claude/docs/diagrams/README.md"
)

MISSING_FILES=0

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    error "Required file missing: $file"
    MISSING_FILES=$((MISSING_FILES + 1))
  fi
done

if [ $MISSING_FILES -eq 0 ]; then
  success "All ${#REQUIRED_FILES[@]} core documentation files exist"
else
  error "$MISSING_FILES/${#REQUIRED_FILES[@]} core files missing"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check 5: Recent Learnings Count
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
check_start "Recent Learnings"

# Count "Recent Learnings" section in CLAUDE.md
if [ -f "CLAUDE.md" ]; then
  # Count items under "Recent Learnings" (lines starting with ### after "Recent Learnings" heading)
  RECENT_COUNT=$(awk '/^## .*Recent Learnings/,/^## / {if (/^###/) count++} END {print count+0}' CLAUDE.md)

  echo "   Recent learnings in CLAUDE.md: $RECENT_COUNT"

  if [ "$RECENT_COUNT" -gt 10 ]; then
    warning "Too many recent learnings ($RECENT_COUNT > 10) - archive older ones"
  else
    success "Recent learnings count within limit ($RECENT_COUNT ≤ 10)"
  fi
else
  error "CLAUDE.md not found"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check 6: Validation Scripts
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
check_start "Validation Scripts"

# Check if package.json has validation scripts
if [ -f "package.json" ]; then
  if grep -q '"format:md"' package.json; then
    echo "   ✓ format:md script found"
  else
    warning "format:md script not found in package.json"
  fi

  if grep -q '"format:md:claude"' package.json; then
    echo "   ✓ format:md:claude script found"
  else
    warning "format:md:claude script not found in package.json"
  fi

  if grep -q '"lint:md"' package.json; then
    echo "   ✓ lint:md script found"
  else
    warning "lint:md script not found in package.json"
  fi

  success "Validation scripts configured"
else
  error "package.json not found"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check 7: Active Planning Sessions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
check_start "Active Planning Sessions"

CHECKPOINT_FILES=$(find .claude/sessions/planning -name ".checkpoint.json" 2>/dev/null)
CHECKPOINT_COUNT=$(echo "$CHECKPOINT_FILES" | grep -c . || echo "0")

if [ "$CHECKPOINT_COUNT" -gt 0 ]; then
  echo "   Found $CHECKPOINT_COUNT active planning sessions:"

  for checkpoint in $CHECKPOINT_FILES; do
    SESSION_DIR=$(dirname "$checkpoint")
    SESSION_NAME=$(basename "$SESSION_DIR")
    CURRENT_TASK=$(jq -r '.currentTask // "unknown"' "$checkpoint" 2>/dev/null)
    TASKS_COMPLETED=$(jq -r '.tasksCompleted // 0' "$checkpoint" 2>/dev/null)
    TOTAL_STEPS=$(jq -r '.totalSteps // 0' "$checkpoint" 2>/dev/null)

    if [ "$TOTAL_STEPS" -gt 0 ]; then
      PROGRESS=$(( (TASKS_COMPLETED * 100) / TOTAL_STEPS ))
      echo "   📋 $SESSION_NAME: $CURRENT_TASK ($TASKS_COMPLETED/$TOTAL_STEPS - ${PROGRESS}%)"
    else
      echo "   📋 $SESSION_NAME: $CURRENT_TASK"
    fi
  done

  success "Planning session tracking active"
else
  info "No active planning sessions found"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Summary Report
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Health Check Summary                ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo "   Total checks: $CHECKS"
echo -e "   ${RED}Errors: $ERRORS${NC}"
echo -e "   ${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

# Exit with appropriate code
if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}❌ Health check FAILED - $ERRORS critical issue(s) detected${NC}"
  echo ""
  exit 2
elif [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Health check PASSED with warnings - $WARNINGS non-critical issue(s)${NC}"
  echo ""
  exit 1
else
  echo -e "${GREEN}✅ Health check PASSED - System is healthy!${NC}"
  echo ""
  exit 0
fi
