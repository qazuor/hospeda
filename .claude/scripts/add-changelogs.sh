#!/bin/bash

# Script to add CHANGELOG section to all .claude/*.md files
# Usage: bash .claude/scripts/add-changelogs.sh

set -e

CHANGELOG_TEMPLATE="

---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 1.0.0 | 2025-10-31 | Initial version | @tech-lead | P-004 |
"

# Function to add changelog if not exists
add_changelog() {
  local file="$1"

  # Skip if file already has Changelog section
  if grep -q "^## Changelog" "$file"; then
    echo "  ⏭️  Skipped (already has changelog): $(basename "$file")"
    return
  fi

  # Add changelog at the end
  echo "$CHANGELOG_TEMPLATE" >> "$file"
  echo "  ✅ Added changelog: $(basename "$file")"
}

echo "🔍 Adding CHANGELOG sections to .claude files..."
echo ""

# Process all markdown files in .claude (excluding README.md and specific docs)
total=0
added=0

# Commands
echo "📋 Processing commands..."
for file in .claude/commands/**/*.md; do
  if [[ -f "$file" ]] && [[ "$(basename "$file")" != "README.md" ]]; then
    add_changelog "$file"
    ((total++))
  fi
done

# Skills
echo ""
echo "🎯 Processing skills..."
for file in .claude/skills/**/*.md; do
  if [[ -f "$file" ]] && [[ "$(basename "$file")" != "README.md" ]]; then
    add_changelog "$file"
    ((total++))
  fi
done

# Agents
echo ""
echo "🤖 Processing agents..."
for file in .claude/agents/**/*.md; do
  if [[ -f "$file" ]] && [[ "$(basename "$file")" != "README.md" ]]; then
    add_changelog "$file"
    ((total++))
  fi
done

# Docs (selected files, not all)
echo ""
echo "📚 Processing documentation..."
for file in .claude/docs/{quick-start,glossary,mcp-servers,doc-sync,system-maintenance,CHECKPOINT-SYSTEM,RECOMMENDED-HOOKS}.md; do
  if [[ -f "$file" ]]; then
    add_changelog "$file"
    ((total++))
  fi
done

# Workflows
for file in .claude/docs/workflows/*.md; do
  if [[ -f "$file" ]] && [[ "$(basename "$file")" != "README.md" ]] && [[ "$(basename "$file")" != "INDEX.md" ]]; then
    add_changelog "$file"
    ((total++))
  fi
done

# Standards
for file in .claude/docs/standards/*.md; do
  if [[ -f "$file" ]]; then
    add_changelog "$file"
    ((total++))
  fi
done

# Learnings
for file in .claude/docs/learnings/*.md; do
  if [[ -f "$file" ]] && [[ "$(basename "$file")" != "README.md" ]]; then
    add_changelog "$file"
    ((total++))
  fi
done

echo ""
echo "✅ Done! Processed $total files"
