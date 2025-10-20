# t-prompts

[![CI](https://github.com/habemus-papadum/t-prompts/actions/workflows/ci.yml/badge.svg)](https://github.com/habemus-papadum/t-prompts/actions/workflows/ci.yml)
[![Coverage](https://raw.githubusercontent.com/habemus-papadum/t-prompts/python-coverage-comment-action-data/badge.svg)](https://htmlpreview.github.io/?https://github.com/habemus-papadum/t-prompts/blob/python-coverage-comment-action-data/htmlcov/index.html)
[![TypeScript Coverage](https://raw.githubusercontent.com/habemus-papadum/t-prompts/typescript-coverage-badge/typescript-coverage.svg)](https://github.com/habemus-papadum/t-prompts/tree/main/widgets)
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

This enables riching tooling:
![Widget](docs/screenshot.png)

## Targeted Use Cases

- Prompt Debugging ("What exactly did this tangle of code render too?")
- Prompt Optimization ("What wording and supporting best achieves my goal?")
- Prompt compaction ("How do I get the same result with fewer word?")


## Documentation

📚 **Full documentation:** https://habemus-papadum.github.io/t-prompts/


## Installation

```bash
pip install t-prompts
```

Or with uv:

```bash
uv add t-prompts
```

## Development

This project uses [UV](https://docs.astral.sh/uv/) and [PNPM](https://pnpm.io/) for dependency management.

```bash
# Onetime Setup (per dev machine)
curl -LsSf https://astral.sh/uv/install.sh | sh # Other options exist!
curl -fsSL https://get.pnpm.io/install.sh | sh - # Other options exist!
./scripts/setup-visual-tests.sh

# Repo setup (per clone)
./scripts/setup.sh

# Lint and format
uv run ruff check .
uv run ruff format .

# Build documentation
uv run mkdocs serve
```

See [Developer Setup](https://habemus-papadum.github.io/t-prompts/developer/setup/) for detailed instructions.

## License

MIT License - see LICENSE file for details.
