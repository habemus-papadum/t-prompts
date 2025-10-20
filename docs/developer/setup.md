# Developer Setup

This guide will help you set up your development environment for contributing to t-prompts.

## Clone the Repository

```bash
git clone https://github.com/habemus-papadum/t-prompts.git
cd t-prompts
```

### Setup
```bash
./scripts/setup-visual-tests.sh                      # Install Playwright Chromium for visual tests (once er dev box)
uv run pre-commit install                            # Set up git hooks
./scripts/setup.sh                                   # Complete setup (recommended for fresh clones)
uv sync --frozen                                     # Install Python dependencies only
pnpm install                                         # Install JavaScript dependencies only
```

### Testing
```bash
uv run pytest                                        # Run all tests (includes visual tests)
uv run pytest -m "not visual"                        # Run only unit tests (skip visual tests)
uv run pytest -m visual                              # Run only visual tests
uv run pytest tests/test_example.py                  # Run specific test file
uv run pytest tests/test_example.py::test_version    # Run specific test function
./scripts/test_notebooks.sh                          # Test all demo notebooks (required after notebook changes)
./scripts/nb.sh docs/tutorial.ipynb.                 # Run a single notebook
```

### Code Quality
```bash
uv run ruff check .                                  # Check Python code
uv run ruff format .                                 # Format Python code
uv run ruff check --fix .                            # Fix auto-fixable Python issues
pnpm --filter @t-prompts/widgets lint                # Check TypeScript code
pnpm --filter @t-prompts/widgets typecheck           # Type check TypeScript code
```

### JavaScript Widgets
```bash
pnpm --filter @t-prompts/widgets build:python        # Build widgets for Python integration
pnpm --filter @t-prompts/widgets test                # Run widget unit tests
pnpm --filter @t-prompts/widgets test lineWrap       # Run specific widget test
```

### Documentation
```bash
uv run mkdocs serve                                  # Serve docs locally (auto-reload)
uv run mkdocs build                                  # Build docs (executes notebooks)
```

## Need Help?

- Check the [Architecture documentation](../Architecture.md) for design details
- See [JSON Format Reference](json-format.md) for JSON export format
- Review [Widget Architecture](widget-architecture.md) for widget system design
- Open an issue on GitHub for questions or bug reports

## Next Steps

- Read the [JSON Format Reference](json-format.md) to understand the JSON export format
- Explore the [Architecture documentation](../Architecture.md) for system design
- Review the [Widget Architecture](widget-architecture.md) for the widget system
- Check out the [API Reference](../reference.md) for detailed API docs
