# Developer Setup

This guide will help you set up your development environment for contributing to t-prompts.

## Prerequisites

- **Python 3.14+** (required for t-string support)
- **Git**
- **UV** (Python package installer and project manager)

## Clone the Repository

```bash
git clone https://github.com/habemus-papadum/t-prompts.git
cd t-prompts
```

## Install UV

If you don't have UV installed, install it using:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Or on Windows:

```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

For more installation options, see the [UV documentation](https://docs.astral.sh/uv/).

## Install pnpm

The project uses pnpm for JavaScript/TypeScript widget development. Install pnpm:

```bash
npm install -g pnpm@9
```

Or using Homebrew on macOS:

```bash
brew install pnpm
```

For other installation methods, see the [pnpm documentation](https://pnpm.io/installation).

## Set Up the Development Environment

Install all dependencies including optional extras:

```bash
uv sync --frozen --all-extras
```

This command:
- Uses `--frozen` to install exact versions from the lockfile
- Uses `--all-extras` to install all optional dependencies (image support, UI, etc.)

## Install JavaScript Dependencies

From the repository root, install JavaScript dependencies:

```bash
pnpm install
```

## Build Widgets

Build the JavaScript widgets (required before running tests):

```bash
pnpm build
```

This will compile TypeScript sources in `widgets/src/` to `widgets/dist/`, which gets bundled with the Python package.

## Set Up Visual Testing

Visual tests run by default when you run `pytest`. You'll need to install Chromium:

```bash
# Option 1: Use the setup script (recommended)
./scripts/setup-visual-tests.sh

# Option 2: Manual installation
uv run playwright install chromium
```

**If you skip this step**: Visual tests will fail when running `pytest`. You can temporarily skip them with `pytest -m "not visual"` until you install Chromium.

## Verify Installation

Run the test suite to verify everything is working:

```bash
# Run all tests except visual tests (no Playwright needed)
uv run pytest -m "not visual"

# Run all tests including visual tests (requires Playwright browsers)
uv run pytest
```

You should see all tests passing.

## Development Workflow

### Running Tests

```bash
# Run all tests
uv run pytest

# Run specific test file
uv run pytest tests/test_core.py

# Run with verbose output
uv run pytest -v

# Run with coverage
uv run pytest --cov=src/t_prompts
```

### Linting and Formatting

```bash
# Check code with ruff
uv run ruff check .

# Auto-fix issues
uv run ruff check --fix .

# Format code
uv run ruff format .
```

### Building Documentation

```bash
# Serve documentation locally (auto-reloads on changes)
uv run mkdocs serve

# Build documentation
uv run mkdocs build
```

The documentation will be available at `http://127.0.0.1:8000/`.

### Building Widgets

```bash
# Build all widgets
pnpm build

# Run widget tests
pnpm test

# Run widget linting
pnpm lint

# Type check widgets
cd widgets && pnpm run typecheck
```

**Important**: After modifying widget source code, you must run `pnpm build` before testing the Python package, as the compiled JavaScript is bundled with the package.

### Running Jupyter Notebooks

```bash
# Start Jupyter
uv run jupyter lab

# Or convert a notebook to execute it
uv run jupyter nbconvert --to notebook --execute docs/demos/01-basic.ipynb
```

## Project Structure

```
t-prompts/
├── src/t_prompts/       # Main package source code
│   ├── core.py          # Core StructuredPrompt implementation
│   ├── parsing.py       # Format spec and render hint parsing
│   ├── text.py          # Text processing (dedenting)
│   └── exceptions.py    # Custom exceptions
├── tests/               # Test suite
├── docs/                # Documentation
│   ├── demos/           # Jupyter notebook tutorials
│   └── developer/       # Developer documentation
├── pyproject.toml       # Project configuration
└── uv.lock             # Dependency lockfile
```

## Making Changes

1. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and add tests

3. Run tests and linting:
   ```bash
   uv run pytest
   uv run ruff check .
   uv run ruff format .
   ```

4. Commit your changes:
   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

5. Push and create a pull request:
   ```bash
   git push origin feature/your-feature-name
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
