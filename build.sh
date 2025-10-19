#!/usr/bin/env bash

# Setup script for t-prompts development environment
# Run this after a fresh clone to set up the project

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

# Change to repo root
cd "$REPO_ROOT"

echo "============================================="
echo "Build t-prompts                              "
echo "============================================="
echo ""

# Check for required tools
echo "1. Checking prerequisites..."
echo ""

if ! command -v uv &> /dev/null; then
    echo "❌ Error: uv is not installed"
    echo "   Install it from: https://docs.astral.sh/uv/getting-started/installation/"
    exit 1
fi
echo "   ✓ uv found: $(uv --version)"

if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is not installed"
    echo "   Install it from: https://pnpm.io/installation"
    exit 1
fi
echo "   ✓ pnpm found: $(pnpm --version)"

echo ""
echo "2. Installing Python dependencies..."
uv sync --frozen

echo ""
echo "3. Installing pnpm packages..."
pnpm install --frozen-lockfile

echo ""
echo "4. Building TypeScript widgets..."
pnpm --filter @t-prompts/widgets build:python


echo ""
echo "============================================="
echo "✅ Build complete!"
echo "============================================="
echo ""
