#!/bin/bash
# Setup script for visual testing with Playwright
# This script installs Playwright browsers needed for visual tests

set -e

echo "Setting up visual testing environment..."

# Install Playwright browsers
echo "Installing Playwright Chromium browser..."
uv run playwright install chromium

echo ""
echo "✅ Visual testing setup complete!"
echo ""
echo "You can now run visual tests with:"
echo "  uv run pytest -m visual"
