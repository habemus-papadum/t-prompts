#!/bin/bash
set -e  # Exit on any error

echo "================================"
echo "Pre-Release Checks"
echo "================================"

echo ""
echo "1. TypeScript Lint..."
pnpm --filter @t-prompts/widgets lint

echo ""
echo "2. TypeScript Build..."
pnpm --filter @t-prompts/widgets build:python

echo ""
echo "3. TypeScript Tests..."
pnpm --filter @t-prompts/widgets test

echo ""
echo "4. Check Git Status (must be clean)..."
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ Error: Git working directory is not clean. Please commit or stash changes first."
  exit 1
fi
echo "✓ Git working directory is clean"

echo ""
echo "5. Python Lint..."
uv run ruff check .

echo ""
echo "6. Update Notebooks (in-place)..."
./test_notebooks.sh

echo ""
echo "7. Commit Updated Notebooks..."
if [[ -n $(git status --porcelain) ]]; then
  git add docs/demos/*.ipynb docs/demos/topics/*.ipynb
  git commit -m "Update notebooks prior to release"
  echo "✓ Notebooks committed"
else
  echo "✓ No notebook changes to commit"
fi

echo ""
echo "8. Python Tests..."
uv run pytest

echo ""
echo "================================"
echo "✅ All pre-release checks passed!"
echo "================================"
