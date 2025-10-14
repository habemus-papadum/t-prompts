# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Python library called `structured-prompts` that provides structured prompts using template strings. The project is in early development stage (v0.1.0) and uses a modern Python toolchain.

## Development Commands

### Environment Setup
```bash
# Install dependencies and sync environment
uv sync
```

### Testing
```bash
# Run all tests
uv run pytest

# Run a specific test file
uv run pytest tests/test_example.py

# Run a specific test function
uv run pytest tests/test_example.py::test_version
```

### Code Quality
```bash
# Check code with ruff
uv run ruff check .

# Format code with ruff
uv run ruff format .

# Fix auto-fixable issues
uv run ruff check --fix .
```

### Documentation
```bash
# Serve documentation locally (auto-reloads on changes)
uv run mkdocs serve

# Build documentation
uv run mkdocs build
```

### Publishing
```bash
# Build and publish to PyPI (requires credentials)
./publish.sh
```

## Architecture

### Project Structure
- **src/structured_prompts/**: Main package source code (src-layout)
- **tests/**: Test suite using pytest
- **docs/**: MkDocs documentation with mkdocstrings for API reference

### Key Constraints
- **Python Version**: Requires Python 3.14+ (see pyproject.toml:20)
- **Dependency Management**: Uses UV exclusively; uv.lock is committed
- **Build System**: Uses Hatch/Hatchling for building distributions
- **Documentation Style**: NumPy docstring style (see mkdocs.yml:25)

### Code Standards
- **Ruff Configuration**:
  - Target: Python 3.14
  - Line length: 120 characters
  - Linting rules: E (pycodestyle errors), F (pyflakes), W (warnings), I (isort)

### Testing Configuration
- Test files must start with `test_` prefix
- Test classes must start with `Test` prefix
- Test functions must start with `test_` prefix
- Tests run with `-s` flag (no capture) by default
