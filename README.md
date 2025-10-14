# t-prompts

[![CI](https://github.com/habemus-papadum/t-prompts/actions/workflows/ci.yml/badge.svg)](https://github.com/habemus-papadum/t-prompts/actions/workflows/ci.yml)
[![Coverage](https://raw.githubusercontent.com/habemus-papadum/t-prompts/python-coverage-comment-action-data/badge.svg)](https://htmlpreview.github.io/?https://github.com/habemus-papadum/t-prompts/blob/python-coverage-comment-action-data/htmlcov/index.html)
[![Documentation](https://img.shields.io/badge/Documentation-blue.svg)](https://habemus-papadum.github.io/t-prompts/)
[![PyPI](https://img.shields.io/pypi/v/t-prompts.svg)](https://pypi.org/project/t-prompts/)
[![Python 3.14+](https://img.shields.io/badge/python-3.14+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Code style: ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)

**Provenance-preserving prompts for LLMs using Python 3.14's template strings**

`t-prompts` turns Python 3.14+ t-strings into navigable trees that preserve full provenance (expression text, conversions, format specs) while rendering to plain strings. Perfect for building, composing, and auditing LLM prompts.

## What is t-prompts?

`t-prompts` is a tiny Python library that leverages Python 3.14's new template string literals (t-strings) to create **structured, inspectable prompts** for LLMs. Unlike f-strings which immediately evaluate to strings, t-strings return a `Template` object that preserves:

- The original expression text for each interpolation
- Conversion flags (`!s`, `!r`, `!a`)
- Format specifications
- The ability to compose prompts recursively

This library wraps t-strings in a `StructuredPrompt` that acts like both a renderable string and a navigable tree.

## Why use it?

**For LLM applications:**
- **Traceability**: Know exactly which variable produced which part of your prompt
- **Structured Access**: Navigate and inspect nested prompt components by key
- **Composability**: Build complex prompts from smaller, reusable pieces
- **Auditability**: Export full provenance information for logging and debugging
- **Type Safety**: Only strings and nested prompts allowed—no accidental `str(obj)` surprises

## Quick Start

**Requirements:** Python 3.14+

### Basic Usage

```python
from t_prompts import prompt

# Simple prompt with labeled interpolation
instructions = "Always answer politely."
p = prompt(t"Obey {instructions:inst}")

# Renders like an f-string
assert str(p) == "Obey Always answer politely."

# But preserves provenance
node = p['inst']
assert node.expression == "instructions"  # Original variable name
assert node.value == "Always answer politely."
```

### Composing Prompts

```python
# Build prompts from smaller pieces
system_msg = "You are a helpful assistant."
user_query = "What is Python?"

p_system = prompt(t"{system_msg:system}")
p_user = prompt(t"User: {user_query:query}")

# Compose into larger prompt
p_full = prompt(t"{p_system:sys} {p_user:usr}")

# Renders correctly
print(str(p_full))
# "You are a helpful assistant. User: What is Python?"

# Navigate the tree
assert p_full['sys']['system'].value == "You are a helpful assistant."
assert p_full['usr']['query'].value == "What is Python?"
```

### Provenance Access

```python
context = "User is Alice"
instructions = "Be concise"

p = prompt(t"Context: {context:ctx}. {instructions:inst}")

# Export to JSON for logging
provenance = p.to_provenance()
# {
#   "strings": ["Context: ", ". ", ""],
#   "nodes": [
#     {"key": "ctx", "expression": "context", "value": "User is Alice", ...},
#     {"key": "inst", "expression": "instructions", "value": "Be concise", ...}
#   ]
# }

# Or get just the values
values = p.to_values()
# {"ctx": "User is Alice", "inst": "Be concise"}
```

### Keying Rules

- **With format spec**: `{var:key}` → use `"key"`
- **Without format spec**: `{var}` → use `"var"` (the expression text)

```python
x = "X"
p1 = prompt(t"{x:custom_key}")
assert 'custom_key' in p1

p2 = prompt(t"{x}")
assert 'x' in p2
```

## Features

- **Dict-like access**: `p['key']` returns the interpolation node
- **Nested composition**: Prompts can contain other prompts
- **Provenance tracking**: Full metadata (expression, conversion, format spec)
- **Conversions**: Supports `!s`, `!r`, `!a` from t-strings
- **JSON export**: `to_values()` and `to_provenance()` for serialization
- **Type validation**: Only `str` and `StructuredPrompt` values allowed
- **Immutable**: `StructuredInterpolation` nodes are frozen dataclasses

## Installation

Install using pip:

```bash
pip install t-prompts
```

Or using uv:

```bash
uv pip install t-prompts
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
