# structured-prompts

[![CI](https://github.com/habemus-papadum/structured-prompts/actions/workflows/ci.yml/badge.svg)](https://github.com/habemus-papadum/structured-prompts/actions/workflows/ci.yml)
[![Coverage](https://raw.githubusercontent.com/habemus-papadum/structured-prompts/python-coverage-comment-action-data/badge.svg)](https://htmlpreview.github.io/?https://github.com/habemus-papadum/structured-prompts/blob/python-coverage-comment-action-data/htmlcov/index.html)
[![Documentation](https://img.shields.io/badge/Documentation-blue.svg)](https://habemus-papadum.github.io/structured-prompts/)
[![PyPI](https://img.shields.io/pypi/v/structured-prompts.svg)](https://pypi.org/project/structured-prompts/)
[![Python 3.14+](https://img.shields.io/badge/python-3.14+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Code style: ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)

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
