#!/bin/bash
set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/.."

# Change to repo root
cd "$REPO_ROOT"

echo "================================"
echo "Pre-Release Checks"
echo "================================"

echo ""
echo "1. TypeScript Lint..."
pnpm --filter @t-prompts/widgets lint

echo ""
echo "2. TypeScript Type Check..."
pnpm --filter @t-prompts/widgets typecheck

echo ""
echo "3. TypeScript Build..."
pnpm --filter @t-prompts/widgets build:python

echo ""
echo "4. TypeScript Tests..."
pnpm --filter @t-prompts/widgets test

echo ""
echo "5. Check Git Status (must be clean)..."
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ Error: Git working directory is not clean. Please commit or stash changes first."
  exit 1
fi
echo "✓ Git working directory is clean"

echo ""
echo "6. Python Lint..."
uv run ruff check .


echo ""
echo "7. Python Tests..."
uv run pytest

echo ""
echo "================================"
echo "✅ All pre-release checks passed!"
echo "================================"
