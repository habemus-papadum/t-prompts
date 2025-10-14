# Installation

## Requirements

**Python 3.14+** is required. This library uses Python 3.14's new template string literals (t-strings), which are not available in earlier versions.

## Installing with pip

Install the base package using pip:

```bash
pip install t-prompts
```

## Installing with uv

[UV](https://docs.astral.sh/uv/) is a fast Python package installer and resolver:

```bash
uv pip install t-prompts
```

## Optional Dependencies

### Image Support

To use PIL Image interpolation in your prompts:

```bash
pip install t-prompts[image]
```

Or with uv:

```bash
uv pip install t-prompts[image]
```

This installs Pillow (PIL) for image handling.

## Verifying Installation

After installation, verify that it works:

```python
from t_prompts import prompt

# Test basic functionality
p = prompt(t"Hello {name:n}")
print(p['n'].key)  # Should print: n
```

If you see the output, you're ready to go!

## Upgrading

To upgrade to the latest version:

```bash
pip install --upgrade t-prompts
```

Or with uv:

```bash
uv pip install --upgrade t-prompts
```

## Next Steps

- [Quick Start](quick-start.md) - Learn the basics
- [Use Cases](use-cases.md) - See what you can build
- [Features](features.md) - Explore all capabilities
