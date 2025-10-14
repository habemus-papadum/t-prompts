# structured-prompts

Structured prompts using template strings

## Installation

Install using pip:

```bash
pip install structured-prompts
```

Or using uv:

```bash
uv pip install structured-prompts
```

## Development

This project uses [UV](https://docs.astral.sh/uv/) for dependency management.

### Setup

```bash
# Install UV if you haven't already
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create a virtual environment and install dependencies
uv sync
```

### Running tests

```bash
uv run pytest
```

### Linting and formatting

```bash
# Check code with ruff
uv run ruff check .

# Format code with ruff
uv run ruff format .
```

### Documentation

Build and serve the documentation locally:

```bash
uv run mkdocs serve
```

## License

MIT License - see LICENSE file for details.
