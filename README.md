# t-prompts

[![CI](https://github.com/habemus-papadum/t-prompts/actions/workflows/ci.yml/badge.svg)](https://github.com/habemus-papadum/t-prompts/actions/workflows/ci.yml)
[![Coverage](https://raw.githubusercontent.com/habemus-papadum/t-prompts/python-coverage-comment-action-data/badge.svg)](https://htmlpreview.github.io/?https://github.com/habemus-papadum/t-prompts/blob/python-coverage-comment-action-data/htmlcov/index.html)
[![Documentation](https://img.shields.io/badge/Documentation-blue.svg)](https://habemus-papadum.github.io/t-prompts/)
[![PyPI](https://img.shields.io/pypi/v/t-prompts.svg)](https://pypi.org/project/t-prompts/)
[![Python 3.14+](https://img.shields.io/badge/python-3.14+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Code style: ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)

**Provenance-preserving prompts for LLMs using Python 3.14's template strings**

## What is t-prompts?

`t-prompts` turns Python 3.14+ t-strings into navigable trees that preserve full provenance information (expression text, conversions, format specs). Perfect for building, composing, and auditing LLM prompts.

Unlike f-strings which immediately evaluate to strings, `t-prompts` keeps the structure intact so you can:

- **Trace** exactly which variable produced which part of your prompt
- **Navigate** nested prompt components programmatically
- **Compose** complex prompts from smaller, reusable pieces
- **Audit** with complete provenance for compliance and debugging
- **Validate** types at prompt creation (no accidental `str(obj)` surprises)

**Requirements:** Python 3.14+

## Quick Example

```python
from t_prompts import prompt

# Create a structured prompt
instructions = "Always answer politely."
p = prompt(t"Obey {instructions:inst}")

# Renders like an f-string
print(str(p))  # "Obey Always answer politely."

# But preserves full provenance
node = p['inst']
print(node.expression)  # "instructions" (original variable name)
print(node.value)       # "Always answer politely."
```

## Documentation

📚 **Full documentation:** https://habemus-papadum.github.io/t-prompts/

- [Installation](https://habemus-papadum.github.io/t-prompts/installation/) - Install the library
- [Quick Start](https://habemus-papadum.github.io/t-prompts/quick-start/) - Learn the basics
- [Use Cases](https://habemus-papadum.github.io/t-prompts/use-cases/) - See what you can build
- [Features](https://habemus-papadum.github.io/t-prompts/features/) - Explore all capabilities
- [Tutorials](https://habemus-papadum.github.io/t-prompts/demos/01-basic/) - Interactive guides

## Installation

```bash
pip install t-prompts
```

Or with uv:

```bash
uv pip install t-prompts
```

For image support:

```bash
pip install t-prompts[image]
```

## Development

This project uses [UV](https://docs.astral.sh/uv/) for dependency management.

```bash
# Setup
curl -LsSf https://astral.sh/uv/install.sh | sh
uv sync --frozen --all-extras

# Install Playwright browsers for visual tests
./scripts/setup-visual-tests.sh

# Run tests (includes visual tests)
uv run pytest

# Lint and format
uv run ruff check .
uv run ruff format .

# Build documentation
uv run mkdocs serve
```

See [Developer Setup](https://habemus-papadum.github.io/t-prompts/developer/setup/) for detailed instructions.

## License

MIT License - see LICENSE file for details.
