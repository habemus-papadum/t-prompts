# Testing Guide

Complete guide to testing both Python and TypeScript code in t-prompts.

## Quick Reference

```bash
# Python tests
uv run pytest                    # All tests (includes visual)
uv run pytest -m "not visual"    # Skip visual tests
uv run pytest --cov              # With coverage

# TypeScript tests
pnpm test                        # Run all widget tests
pnpm test:coverage               # With coverage
pnpm test:watch                  # Watch mode
```

## Python Testing

### Setup

Tests use pytest and require Python 3.14+. Visual tests additionally require Playwright browsers:

```bash
# One-time setup for visual tests
./scripts/setup-visual-tests.sh
# OR manually:
uv run playwright install chromium
```

### Running Tests

```bash
# Basic usage
uv run pytest                           # All tests
uv run pytest tests/test_core.py        # Specific file
uv run pytest tests/test_core.py::test_simple_interpolation  # Specific test

# Filters
uv run pytest -m "not visual"           # Skip visual tests
uv run pytest -m visual                 # Only visual tests
uv run pytest -k "dedent"               # Tests matching pattern

# Output control
uv run pytest -v                        # Verbose
uv run pytest -s                        # Show print statements
uv run pytest -x                        # Stop on first failure
uv run pytest --durations=10            # Show slowest tests

# Coverage
uv run pytest --cov=src/t_prompts
uv run pytest --cov=src/t_prompts --cov-report=html
open htmlcov/index.html
```

### Test Structure

**Unit tests** (`tests/test_*.py`) - Core functionality
```python
from t_prompts import prompt

def test_simple_interpolation():
    """Test basic interpolation."""
    task = "translate"
    p = prompt(t"Task: {task:t}")

    assert str(p) == "Task: translate"
    assert p["t"].value == "translate"
```

**Visual tests** (`tests/visual/`) - Browser-based widget rendering
```python
import pytest

@pytest.mark.visual
def test_widget_renders(widget_page, wait_for_widget_render, page):
    """Test widget renders correctly in browser."""
    p = prompt(t"Test: {value:v}")

    widget_page(p, "test.html", "Test Widget")
    wait_for_widget_render()

    assert page.locator('.tp-pane-code').count() > 0
```

**Key fixtures:**
- `widget_page(obj, filename, title)` - Load widget in browser
- `wait_for_widget_render()` - Wait for all panes to render
- `take_screenshot(name)` - Capture screenshot
- `page` - Playwright page object

### Debugging Visual Tests

```bash
# See browser
uv run pytest -m visual --headed

# Use Playwright inspector
PWDEBUG=1 uv run pytest -m visual

# Increase timeouts
uv run pytest -m visual --timeout=300000
```

## TypeScript Testing

### Running Tests

Tests use Vitest with jsdom for DOM simulation:

```bash
# Basic usage
pnpm test                    # Run all tests once
pnpm test:watch              # Watch mode for development
pnpm test:coverage           # Generate coverage report

# Specific tests
pnpm test src/components/CodeView.test.ts
pnpm test -- --reporter=verbose
```

### Test Structure

Widget tests are located in `widgets/src/**/*.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { buildCodeView } from './CodeView';

describe('CodeView', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders code chunks correctly', () => {
    const widgetData = {
      compiled_ir: { /* ... */ },
      ir: { /* ... */ },
    };

    const codeView = buildCodeView(container, widgetData);
    expect(container.children.length).toBeGreaterThan(0);
  });
});
```

### Coverage

Coverage reports are saved to `widgets/coverage/`:

```bash
pnpm test:coverage
open widgets/coverage/index.html
```

Configuration is in `widgets/vitest.config.ts`.

## Configuration

### pytest (`pyproject.toml`)

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
markers = [
    "visual: Browser-based visual tests"
]
```

### Vitest (`widgets/vitest.config.ts`)

```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

## Best Practices

### General
- Test one behavior per test function
- Use descriptive test names
- Follow Arrange-Act-Assert pattern
- Keep tests independent

### Python-specific
- Mark visual tests with `@pytest.mark.visual`
- Always call `wait_for_widget_render()` in visual tests
- Use fixtures to share setup code

### TypeScript-specific
- Use `beforeEach` for test setup
- Mock external dependencies
- Test component behavior, not implementation

## Troubleshooting

**"Playwright not installed"**
```bash
uv run playwright install chromium
```

**"Tests fail locally but pass in CI"**
- Check Python version: `python --version` (must be 3.14+)
- Rebuild widgets: `pnpm build`
- Sync dependencies: `uv sync`

**"Visual tests timeout"**
- Run in headed mode: `--headed`
- Increase timeout: `--timeout=10000`
- Check browser console for errors

**"TypeScript tests fail"**
- Rebuild bundle: `node build.js`
- Check Node version: `node --version` (must be 18+)
- Clear node_modules: `rm -rf node_modules && pnpm install`

## CI/CD

GitHub Actions runs:
- Python tests (unit + visual in headless mode)
- TypeScript tests with coverage
- Linting and type checking
- Coverage reporting

See `.github/workflows/` for configuration.
