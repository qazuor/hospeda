#!/bin/bash
# Cleanup merged worktrees

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧹 Cleaning up merged worktrees"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Update main branch
echo "📡 Fetching latest changes..."
git fetch origin main
git checkout main
git pull origin main

echo ""
echo "🔍 Checking for merged branches..."
echo ""

REMOVED_COUNT=0
KEPT_COUNT=0

# Get list of worktrees
git worktree list --porcelain | while read -r line; do
  if [[ $line == worktree* ]]; then
    WORKTREE_PATH=${line#worktree }
    CURRENT_PATH="$WORKTREE_PATH"
  elif [[ $line == branch* ]]; then
    BRANCH=${line#branch refs/heads/}

    # Skip main branch
    if [[ $BRANCH == "main" ]]; then
      continue
    fi

    # Check if merged
    if git branch --merged main | grep -q "^  $BRANCH\$" 2>/dev/null; then
      echo "🗑️  Removing: $CURRENT_PATH ($BRANCH)"

      # Remove worktree
      if git worktree remove "$CURRENT_PATH" 2>/dev/null; then
        echo "   ✅ Worktree removed"
      else
        echo "   ⚠️  Failed to remove worktree (might have uncommitted changes)"
        continue
      fi

      # Delete local branch
      if git branch -d "$BRANCH" 2>/dev/null; then
        echo "   ✅ Branch deleted"
      else
        echo "   ⚠️  Failed to delete branch"
      fi

      REMOVED_COUNT=$((REMOVED_COUNT + 1))
      echo ""
    else
      echo "⏭️  Keeping: $CURRENT_PATH ($BRANCH) - not merged"
      KEPT_COUNT=$((KEPT_COUNT + 1))
    fi
  fi
done

# Prune deleted worktrees
echo ""
echo "🔧 Pruning deleted worktrees..."
git worktree prune

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Cleanup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Removed: $REMOVED_COUNT worktree(s)"
echo "Kept:    $KEPT_COUNT worktree(s)"
echo ""

# Show remaining worktrees
echo "📋 Current worktrees:"
git worktree list
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
