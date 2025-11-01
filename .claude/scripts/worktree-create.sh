#!/bin/bash
# Create worktree with project conventions

set -e

if [ -z "$1" ]; then
  echo "Usage: ./worktree-create.sh <branch-name> [base-branch]"
  echo ""
  echo "Examples:"
  echo "  ./worktree-create.sh feature/auth main"
  echo "  ./worktree-create.sh fix/login-bug main"
  echo "  ./worktree-create.sh hotfix/critical main"
  echo ""
  exit 1
fi

BRANCH=$1
BASE_BRANCH=${2:-main}
WORKTREE_NAME="hospeda-${BRANCH//\//-}"
WORKTREE_PATH="../${WORKTREE_NAME}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌿 Creating Worktree"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Branch:      $BRANCH"
echo "Base:        $BASE_BRANCH"
echo "Path:        $WORKTREE_PATH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if base branch exists
if ! git rev-parse --verify "$BASE_BRANCH" >/dev/null 2>&1; then
  echo "❌ Base branch '$BASE_BRANCH' not found"
  exit 1
fi

# Create worktree
echo "📁 Creating worktree..."
git worktree add "$WORKTREE_PATH" -b "$BRANCH" "$BASE_BRANCH"

# Navigate to worktree
cd "$WORKTREE_PATH"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Worktree created successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 Path:   $WORKTREE_PATH"
echo "🌿 Branch: $BRANCH"
echo ""
echo "Next steps:"
echo "  cd $WORKTREE_PATH"
echo "  pnpm dev"
echo ""
echo "When done:"
echo "  cd ~/projects/hospeda"
echo "  git worktree remove $WORKTREE_PATH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
