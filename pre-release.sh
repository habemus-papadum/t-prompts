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
pnpm --filter @t-prompts/widgets build

echo ""
echo "3. TypeScript Tests..."
pnpm --filter @t-prompts/widgets test

echo ""
echo "4. Python Lint..."
uv run ruff check .

echo ""
echo "5. Python Tests..."
uv run pytest

echo ""
echo "6. Notebook Tests..."
./test_notebooks.sh --no-inplace

echo ""
echo "================================"
echo "✅ All pre-release checks passed!"
echo "================================"
