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

### Lists of Prompts

**New feature**: Interpolate lists of `StructuredPrompt` objects with customizable separators!

```python
# Create a list of example prompts
examples = [
    prompt(t"{ex:example}") for ex in [
        "The cat sat on the mat.",
        "Python is great.",
        "AI is fascinating."
    ]
]

# Interpolate the list with default separator (newline)
p = prompt(t"Examples:\n{examples:examples}")
print(str(p))
# Examples:
# The cat sat on the mat.
# Python is great.
# AI is fascinating.

# Use custom separator with render hints
p2 = prompt(t"Examples: {examples:examples:sep= | }")
print(str(p2))
# Examples: The cat sat on the mat. | Python is great. | AI is fascinating.
```

**Separator syntax**: Use `sep=<value>` in render hints to specify a custom separator. The default is a newline (`\n`).

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

### Format Spec Mini-Language

Format specs follow the pattern `key : render_hints`:

- **No format spec**: `{var}` → key = `"var"`
- **Underscore**: `{var:_}` → key = `"var"` (explicitly use expression)
- **Simple key**: `{var:custom_key}` → key = `"custom_key"`, no hints
- **With hints**: `{var:key:hint1:hint2}` → key = `"key"`, hints = `"hint1:hint2"`

```python
from t_prompts import prompt

# Simple keying
x = "X"
p1 = prompt(t"{x:custom_key}")
assert 'custom_key' in p1

# With render hints (for future use)
data = '{"name": "Alice"}'
p2 = prompt(t"{data:user_data:format=json,indent=2}")
assert 'user_data' in p2
assert p2['user_data'].render_hints == "format=json,indent=2"

# Use expression as key
value = "test"
p3 = prompt(t"{value:_}")
assert 'value' in p3
```

**Note**: Render hints are stored but not currently applied during rendering. They're available for custom renderers or tooling.

### Source Mapping

`render()` returns a `RenderedPrompt` with bidirectional text ↔ structure mapping:

```python
from t_prompts import prompt

name = "Alice"
age = "30"
p = prompt(t"Name: {name:n}, Age: {age:a}")

rendered = p.render()

# Access the text
print(rendered.text)  # "Name: Alice, Age: 30"

# Find what produced a position in the text
span = rendered.get_span_at(8)  # Position 8 is in "Alice"
print(span.key)  # "n"
print(rendered.text[span.start:span.end])  # "Alice"

# Find where a key was rendered
span = rendered.get_span_for_key("a")
print(rendered.text[span.start:span.end])  # "30"

# Access the original prompt
assert rendered.source_prompt is p

# str() for convenience
assert str(p) == rendered.text
```

### Elements and Static Text

As of version 0.4.0, `t-prompts` provides unified access to **all** parts of your prompt through the `Element` base class:

- **`Static`**: Represents literal text segments between interpolations
- **`StructuredInterpolation`**: Represents interpolated values (what you're already familiar with)

Both extend the `Element` base class, giving you complete visibility into your prompt's structure:

```python
from t_prompts import prompt

value = "test"
p = prompt(t"prefix {value:v} suffix")

# Access all elements (statics and interpolations)
elements = p.elements
print(len(elements))  # 3: Static("prefix "), Interpolation(v), Static(" suffix")

# Each element has key, parent, index, and value
for elem in elements:
    print(f"{elem.__class__.__name__}: key={elem.key}, index={elem.index}")
# Static: key=0, index=0
# StructuredInterpolation: key='v', index=1
# Static: key=1, index=2

# Static elements use integer keys (position in template strings tuple)
# Interpolations use string keys (from format spec or expression)
```

**Source mapping for static text**: The source map now includes spans for static text segments too:

```python
name = "Alice"
p = prompt(t"Hello {name:n}!")

rendered = p.render()

# Find static text at position 0
span = rendered.get_span_at(0)  # Position 0 is in "Hello "
print(span.element_type)  # "static"
print(span.key)  # 0 (first static segment)
print(rendered.text[span.start:span.end])  # "Hello "

# Or use the helper method
static_span = rendered.get_static_span(0)
print(rendered.text[static_span.start:static_span.end])  # "Hello "

# Interpolations work the same way
interp_span = rendered.get_interpolation_span("n")
print(rendered.text[interp_span.start:interp_span.end])  # "Alice"
```

**Why this matters**: Complete source mapping enables powerful tooling for:

- Highlighting and navigating entire prompts in UIs
- Tracking which parts of a prompt came from templates vs. variables
- Debugging and auditing LLM inputs with full context
- Building editors that understand prompt structure

## Features

- **Dict-like access**: `p['key']` returns the interpolation node
- **Nested composition**: Prompts can contain other prompts
- **List support**: Interpolate lists of prompts with customizable separators
- **Format spec mini-language**: `key : render_hints` for extensible metadata
- **Complete source mapping**: Bidirectional mapping for ALL text (static and interpolated)
- **Element hierarchy**: Unified `Element` base class for `Static` and `StructuredInterpolation`
- **Provenance tracking**: Full metadata (expression, conversion, format spec, render hints)
- **Conversions**: Supports `!s`, `!r`, `!a` from t-strings
- **JSON export**: `to_values()` and `to_provenance()` for serialization
- **Type validation**: Only `str`, `StructuredPrompt`, and `list[StructuredPrompt]` values allowed
- **Immutable**: All elements are frozen dataclasses

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
