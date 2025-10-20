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

This enables riching tooling:
![Widget](screenshot.png)


## Targeted Use Cases

- *Prompt Debugging:* "What exactly did this tangle of code render to?"
- *Prompt Optimization (Performance):* "What wording / content best achieves my goal?"
- *Prompt Optimization (Size):* "How do I get the same result with fewer words?"
- *Prompt Compacting:* "LLM tells me to keep it short, now what do I do?"

## Caveats:
While this library targets the creation of structured multi-modal prompts, despite the name, there is nothing in particular tying this library to LLMs / Generative models.  (It is more "t" than "prompts") To use it for an actual LLM call, you would need to convert the IR into a model specific form (though for text, it could be as simple as `str(prompt)`)

## Get Started

- [Installation](installation.md) - Install the library
- [Quick Demo](quick_demo.ipynb) - Quick Interactive Demo
- [Tutorials](tutorial.ipynb) - Tutorial
- [Architecture](Architecture.md)
