# t-prompts

[![CI](https://github.com/habemus-papadum/t-prompts/actions/workflows/ci.yml/badge.svg)](https://github.com/habemus-papadum/t-prompts/actions/workflows/ci.yml)
[![Coverage](https://raw.githubusercontent.com/habemus-papadum/t-prompts/python-coverage-comment-action-data/badge.svg)](htmlpreview.github.io/?https://github.com/habemus-papadum/t-prompts/blob/python-coverage-comment-action-data/htmlcov/index.html)
[![TypeScript Coverage](https://raw.githubusercontent.com/habemus-papadum/t-prompts/typescript-coverage-badge/typescript-coverage.svg)](https://github.com/habemus-papadum/t-prompts/tree/main/widgets)
[![Documentation](https://img.shields.io/badge/Documentation-blue.svg)](https://habemus-papadum.github.io/t-prompts/)
[![PyPI](https://img.shields.io/pypi/v/t-prompts.svg)](https://pypi.org/project/t-prompts/)
[![Python 3.14+](https://img.shields.io/badge/python-3.14+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Code style: ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)

**Provenance-preserving prompts for LLMs using Python 3.14's template strings**

`t-prompts` turns Python 3.14+ t-strings into navigable trees that preserve full provenance (expression text, conversions, format specs) while rendering to plain strings. Perfect for building, composing, and auditing LLM prompts.

**Requirements:** Python 3.14+

## Quick Example

```python
from t_prompts import prompt

# Simple prompt with labeled interpolation
instructions = "Always answer politely."
p = prompt(t"Obey {instructions:inst}")

# Renders like an f-string
print(str(p))  # "Obey Always answer politely."

# But preserves provenance
node = p['inst']
print(node.expression)  # "instructions"
print(node.value)       # "Always answer politely."
```

## Get Started

- [Installation](installation.md) - Install the library
- [Quick Start](quick-start.md) - Learn the basics
- [Use Cases](use-cases.md) - See what you can build
- [Features](features.md) - Explore all capabilities
- [Tutorials](demos/01-basic.ipynb) - Step-by-step guides
