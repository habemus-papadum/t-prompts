#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Go to repo root (parent of scripts/)
cd "${SCRIPT_DIR}/.."

rm -rf dist

uv run hatch build
uv run hatch publish
