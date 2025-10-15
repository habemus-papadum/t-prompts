# Testing Guide

This guide covers the testing infrastructure for t-prompts, including unit tests, visual tests, and self-service UI testing tools.

## Overview

The t-prompts project has three types of tests:

1. **Unit Tests** - Fast, focused tests for core functionality
2. **Visual Tests** - Browser-based tests using Playwright for widget rendering
3. **Widget Export** - Utilities for exporting widgets to standalone HTML files

## Quick Start

```bash
# Run all tests (includes visual tests by default - requires Chromium)
uv run pytest

# Run only unit tests (skip visual tests if Chromium not installed)
uv run pytest -m "not visual"

# Run only visual tests
uv run pytest -m visual

# Run with coverage
uv run pytest --cov=src/t_prompts
```

**Note**: Visual tests run by default when you run `pytest`. If you haven't installed Chromium yet, they will fail. Either install Chromium with `./scripts/setup-visual-tests.sh` or skip visual tests with `-m "not visual"`.

## Unit Tests

### Running Unit Tests

```bash
# Run all unit tests
uv run pytest

# Run specific test file
uv run pytest tests/test_core.py

# Run specific test function
uv run pytest tests/test_core.py::test_simple_interpolation

# Verbose output
uv run pytest -v

# Stop at first failure
uv run pytest -x
```

### Writing Unit Tests

Unit tests are located in `tests/` and use pytest:

```python
from t_prompts import prompt

def test_simple_interpolation():
    """Test basic string interpolation."""
    task = "translate"
    p = prompt(t"Task: {task:t}")

    assert str(p) == "Task: translate"
    assert "t" in p.keys()
    assert p["t"].value == "translate"
```

## Visual Tests (Playwright)

Visual tests use Playwright to render widgets in a real browser and verify correct rendering. These tests can take screenshots that can be analyzed programmatically.

### Setup

Visual tests require Playwright browsers to be installed. Unfortunately, there's no Python package that automatically bundles Chromium with Playwright, so you need to install it separately.

**Option 1: Use the setup script** (recommended)
```bash
# Run the setup script
./scripts/setup-visual-tests.sh
```

**Option 2: Manual installation**
```bash
# Install Playwright browsers manually (run once)
uv run playwright install chromium
```

**Note**: The Chromium browser is ~280MB and will be downloaded to your OS-specific cache folder (`~/.cache/ms-playwright` on Linux/macOS, `%USERPROFILE%\AppData\Local\ms-playwright` on Windows).

### Running Visual Tests

```bash
# Run all visual tests
uv run pytest -m visual

# Run specific visual test
uv run pytest tests/visual/test_widget_visual.py::test_simple_prompt_renders -m visual

# Run in headed mode (see browser)
uv run pytest -m visual --headed

# Run with specific browser
uv run pytest -m visual --browser firefox
```

### Writing Visual Tests

Visual tests are located in `tests/visual/` and use custom fixtures:

```python
import pytest
from t_prompts import prompt

@pytest.mark.visual
def test_my_widget(widget_page, take_screenshot, wait_for_widget_render, page):
    """Test that my widget renders correctly."""
    # Create prompt
    p = prompt(t"Test prompt: {value:v}")

    # Load in browser
    widget_page(p, "my_test.html", "My Test Widget")
    wait_for_widget_render()

    # Take screenshot
    screenshot_path = take_screenshot("my_widget")

    # Verify rendering
    assert page.locator('.tp-pane-tree').count() > 0
    assert page.locator('.tp-pane-code').count() > 0
    assert page.locator('.tp-pane-preview').count() > 0

    # Screenshot saved for verification
    assert screenshot_path.exists()
```

### Visual Test Fixtures

The visual testing infrastructure provides several fixtures:

- **`widget_page`** - Function to load a widget into the browser
- **`take_screenshot(name)`** - Capture screenshot of current page
- **`wait_for_widget_render()`** - Wait for all three panes to render
- **`page`** - Playwright page object for direct interaction
- **`widget_test_dir`** - Temporary directory for test HTML files
- **`screenshot_dir`** - Directory where screenshots are saved

### Screenshot Analysis

Screenshots are saved to the temporary `screenshots/` directory during tests. These can be:

- Manually inspected for debugging
- Read programmatically by AI/ML tools for automated verification
- Compared against baseline images for regression testing

## Widget Export Utilities

The `t_prompts.widget_export` module provides utilities for exporting widgets to standalone HTML files. This is useful for:

- Quick manual testing without Jupyter
- Creating visual galleries of widget states
- Sharing widget examples
- Debugging rendering issues

### Save Single Widget

```python
from t_prompts import prompt
from t_prompts.widget_export import save_widget_html

# Create a prompt
task = "translate"
p = prompt(t"Task: {task:t}")

# Export to HTML file
path = save_widget_html(p, "output/widget.html", "My Widget")
print(f"Widget saved to: {path}")

# Open in browser
# open output/widget.html
```

### Create Widget Gallery

```python
from t_prompts import prompt, dedent
from t_prompts.widget_export import create_widget_gallery

# Create multiple widgets
widgets = {
    "Simple": prompt(t"Simple prompt"),
    "Nested": prompt(t"Outer: {prompt(t'Inner'):i}"),
    "Multi-line": dedent(t"""
        Line 1
        Line 2
        Line 3
    """),
}

# Create gallery
path = create_widget_gallery(
    widgets,
    "output/gallery.html",
    "Widget Gallery"
)
print(f"Gallery saved to: {path}")
```

The gallery page displays all widgets with:

- Widget labels and descriptions
- Type information (StructuredPrompt vs IntermediateRepresentation)
- Full three-pane visualization for each widget
- Proper styling and layout

### API Reference

#### `save_widget_html(obj, path, title="T-Prompts Widget")`

Save a widget to a standalone HTML file.

**Parameters:**
- `obj` - StructuredPrompt or IntermediateRepresentation to export
- `path` - Output file path (str or Path)
- `title` - Page title (optional)

**Returns:** Path to created file

#### `create_widget_gallery(widgets, path, title="T-Prompts Widget Gallery")`

Create a gallery page with multiple widgets.

**Parameters:**
- `widgets` - Dict mapping labels to widget objects
- `path` - Output file path (str or Path)
- `title` - Page title (optional)

**Returns:** Path to created file

## Test Coverage

View test coverage reports:

```bash
# Generate coverage report
uv run pytest --cov=src/t_prompts --cov-report=html

# Open in browser
open htmlcov/index.html
```

## CI/CD

The project uses GitHub Actions for continuous integration:

- All tests run on every pull request
- Visual tests run in headless mode
- Coverage reports are generated
- Linting and formatting are enforced

## TODO: Remaining Self-Service Testing Features

The following testing features are planned but not yet implemented:

### Priority 3: Widget State Gallery Generator

Create an automated tool that generates a comprehensive gallery of all widget states:

- All supported data types (strings, nested prompts, lists, images)
- All render hints (xml, header, separator)
- All edge cases (empty prompts, deep nesting, long lists)
- All visual states (light mode, dark mode, responsive layouts)

**Use Case:** Generate a single HTML page showing all possible widget states for comprehensive visual testing.

**Proposed API:**
```python
from t_prompts.testing import generate_widget_state_gallery

# Generate comprehensive gallery
generate_widget_state_gallery("output/all_states.html")
```

### Priority 4: Interactive Testing Utilities (Phase 2)

When interactive widget features are implemented (collapsible trees, syntax highlighting, etc.), add tools for testing interactivity:

- Click handlers and event testing
- State transitions and animations
- Keyboard navigation
- Accessibility features (ARIA, screen readers)

**Use Case:** Test that collapsible tree nodes expand/collapse correctly, syntax highlighting works, etc.

**Proposed API:**
```python
@pytest.mark.visual
def test_tree_collapse(widget_page, page):
    """Test that tree nodes can be collapsed."""
    p = prompt(t"Nested: {inner:i}")
    widget_page(p, "tree_test.html")

    # Find collapsible node
    node = page.locator('.tp-tree-nested_prompt')

    # Click to collapse
    node.click()

    # Verify children are hidden
    assert not node.locator('ul').is_visible()
```

### Priority 5: Enhanced Unit Tests

Improve existing unit tests with:

- Property-based testing (using Hypothesis)
- Performance benchmarks
- Memory profiling tests
- Stress tests (deeply nested prompts, huge lists, large images)
- Fuzzing for edge cases

**Use Case:** Catch edge cases and performance regressions automatically.

**Example:**
```python
from hypothesis import given, strategies as st

@given(st.text())
def test_prompt_with_any_text(text):
    """Test prompts work with any valid Unicode text."""
    p = prompt(t"{text:t}")
    assert str(p) == text
```

## Debugging Tests

### Debugging Visual Tests

```bash
# Run in headed mode to see browser
uv run pytest -m visual --headed

# Add breakpoint in test
import pdb; pdb.set_trace()

# Use Playwright inspector
PWDEBUG=1 uv run pytest -m visual

# Increase timeouts for debugging
uv run pytest -m visual --timeout=300000
```

### Viewing Test Output

```bash
# Show print statements
uv run pytest -s

# Show full diffs
uv run pytest -vv

# Show slowest tests
uv run pytest --durations=10
```

## Best Practices

### Writing Good Tests

1. **Test one thing** - Each test should verify a single behavior
2. **Use descriptive names** - Test names should explain what they test
3. **Follow AAA pattern** - Arrange, Act, Assert
4. **Avoid test interdependence** - Tests should be independent
5. **Use fixtures** - Share setup code with pytest fixtures

### Visual Test Best Practices

1. **Reset state** - Each test should start with a fresh browser state
2. **Wait for rendering** - Always use `wait_for_widget_render()`
3. **Take screenshots** - Capture screenshots for debugging
4. **Test real scenarios** - Use realistic prompts, not trivial examples
5. **Verify DOM structure** - Check that elements are actually visible

### Performance Considerations

- Unit tests should be fast (< 1s per test)
- Visual tests can be slower (2-5s per test) due to browser startup
- Use `pytest -x` to fail fast during development
- Use `pytest -k pattern` to run subset of tests

## Troubleshooting

### Common Issues

**"Playwright not installed"**
```bash
uv run playwright install chromium
```

**"Tests fail locally but pass in CI"**
- Check Python version (must be 3.14+)
- Ensure widgets are built: `pnpm build`
- Sync dependencies: `uv sync --frozen`

**"Visual tests timeout"**
- Increase timeout: `--timeout=10000`
- Check browser logs in headed mode: `--headed`
- Verify widget HTML is valid

**"Screenshots not captured"**
- Screenshots are in temp directory during tests
- Use `screenshot_path` from `take_screenshot()` to find location
- Screenshot directory is cleaned up after tests complete

## Related Documentation

- [Developer Setup](setup.md) - Development environment setup
- [Architecture](../Architecture.md) - System architecture
- [Widget Proposal](../Widget%20proposal.md) - Widget design and implementation

## Need Help?

- Check existing tests for examples
- Open an issue on GitHub
- Review pytest and Playwright documentation
