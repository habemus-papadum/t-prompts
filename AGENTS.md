# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Project Overview

This is a Python library called `t-prompts` (package name: `t-prompts`, module name: `t_prompts`) that provides structured prompts using template strings. The project is in early development stage and uses a modern Python toolchain.

## Important Rules

### Version Management
**NEVER modify the version number in any file.** Version numbers are managed exclusively by humans. Do not change:
- `pyproject.toml` version field
- `src/t_prompts/__init__.py` `__version__` variable
- Any version references in documentation

If you think a version change is needed, inform the user but do not make the change yourself.

### Release Management
**ABSOLUTELY NEVER RUN THE RELEASE SCRIPT (`./release.sh`).** This is a production deployment script that:
- Publishes the package to PyPI (affects real users)
- Creates GitHub releases (public and permanent)
- Pushes commits and tags to the repository
- Triggers documentation deployment

**This script should ONLY be run by a human who fully understands the consequences.** Do not:
- Execute `./release.sh` under any circumstances
- Suggest running it unless the user explicitly asks about the release process
- Include it in automated workflows or scripts

If the user needs to make a release, explain the process but let them run the script themselves.

## Development Commands

### Environment Setup
```bash
# Install dependencies and sync environment (includes dev dependencies)
uv sync --frozen

# Install all optional dependencies (image) for development
uv sync --frozen --all-extras

# Or install specific extras only
uv sync --frozen --extra image
```

**Important for Development**:
- Use `uv sync --frozen --all-extras` to ensure you have all optional dependencies available for testing image features
- The `--frozen` flag ensures the lockfile is used without modification, maintaining reproducible builds
- The optional dependencies are:
  - `image`: Pillow for image interpolation support

### Testing
```bash
# Install Playwright browsers for visual tests (run once)
./scripts/setup-visual-tests.sh
# Or manually: uv run playwright install chromium

# Run all tests (includes visual tests by default)
uv run pytest

# Run only unit tests (skip visual tests)
uv run pytest -m "not visual"

# Run only visual tests
uv run pytest -m visual

# Run a specific test file
uv run pytest tests/test_example.py

# Run a specific test function
uv run pytest tests/test_example.py::test_version
```

**Important**:
- Visual tests run by default and require Chromium (~280MB) to be installed via Playwright
- Use `./scripts/setup-visual-tests.sh` to install Chromium after initial setup
- Visual tests are marked with `@pytest.mark.visual` and test widget rendering in a real browser
- If Chromium is not installed, visual tests will fail - use `-m "not visual"` to skip them temporarily

### Code Quality
```bash
# Check code with ruff
uv run ruff check .

# Format code with ruff
uv run ruff format .

# Fix auto-fixable issues
uv run ruff check --fix .
```

### Documentation
```bash
# Serve documentation locally (auto-reloads on changes)
uv run mkdocs serve

# Build documentation
uv run mkdocs build

# Test demo notebooks (REQUIRED after any notebook changes)
./test_notebooks.sh
```

**Important**: After making any changes to demo notebooks (files in `docs/demos/*.ipynb`), you MUST run `./test_notebooks.sh` to verify the notebook executes without errors. Do not consider notebook changes complete until this test passes.

### Scratchpad Directory

**Always use `scratchpad/` for temporary/test code**:
- Located at project root: `scratchpad/`
- Already in `.gitignore` - won't be committed
- Use for test scripts, generated HTML files, screenshots, etc.
- Clean it up periodically, but don't worry about leaving files

```python
# Example: scratchpad/test_feature.py
from t_prompts import prompt
from t_prompts.widgets import Widget, save_widget_html

@prompt
def test_prompt():
    return "Hello world"

widget = Widget(test_prompt().compile())
save_widget_html(widget, "scratchpad/output.html")
```

### Development Workflows for Visual Widget Changes

When working on visual/UI changes, there are two main workflows:

#### Workflow 1: User as Eyes and Hands (Preferred)

1. **Write code** with unit tests to validate logic
2. **Build**: `pnpm --filter @t-prompts/widgets build`
3. **User previews** the changes in browser (user will run Python code or open HTML)
4. **User provides feedback** via description or screenshot
5. Iterate on changes

This is the preferred workflow for rapid iteration.

#### Workflow 2: Automated Screenshot Testing (Independent)

If you want to verify visual output without user intervention:

1. **Write code** with unit tests
2. **Build**: `pnpm --filter @t-prompts/widgets build`
3. **Create Python test script** in `scratchpad/` directory
4. **Use widget export utilities** to generate screenshots:
   ```python
   from t_prompts import prompt
   from t_prompts.widgets import Widget, save_widget_html

   @prompt
   def my_test():
       return "test content here"

   widget = Widget(my_test().compile())
   save_widget_html(widget, "scratchpad/output.html")
   ```
5. **Run Python code**: `uv run python scratchpad/my_test.py`

Note: Check `src/t_prompts/widgets/preview.py` for additional screenshot/export capabilities.

### JavaScript Widgets

**The project uses pnpm workspaces.** Always use the `--filter` flag to target the correct package from the root directory:

```bash
# Install JavaScript dependencies (from root)
pnpm install

# Build widgets (compiles TypeScript to JavaScript)
pnpm --filter @t-prompts/widgets build

# Run widget tests
pnpm --filter @t-prompts/widgets test

# Run specific test file
pnpm --filter @t-prompts/widgets test lineWrap

# Run widget linting
pnpm --filter @t-prompts/widgets lint

# Type check widgets
pnpm --filter @t-prompts/widgets typecheck
```

**DO NOT** `cd` into subdirectories and run pnpm directly. Use `--filter` from the root.

**Important**: The JavaScript build output (`widgets/dist/`) is committed to version control and bundled with the Python package. After modifying widget sources, you MUST:
1. Write/update unit tests first
2. Run tests: `pnpm --filter @t-prompts/widgets test`
3. Run `pnpm --filter @t-prompts/widgets build` to compile
4. Commit both source and compiled output
5. CI will fail if compiled output is out of sync with sources

#### Writing Widget Unit Tests

Widget code runs in browsers, but tests use `vitest` with `jsdom` to simulate the DOM.

**Test file location**: `widgets/src/**/*.test.ts` (next to the source file)

**Example test structure**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { myTransform } from './myTransform';

describe('myTransform', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Create fresh DOM for each test
    container = document.createElement('div');
  });

  it('should do something', () => {
    const span = document.createElement('span');
    span.setAttribute('data-chunk-id', 'chunk1');
    span.textContent = 'test';
    container.appendChild(span);

    // Test assertions
    expect(container.children.length).toBe(1);
    expect(span.textContent).toBe('test');
  });
});
```

**Key testing patterns**:
- Use `document.createElement()` to build test DOM structures
- Use `querySelector` / `querySelectorAll` to inspect results
- Check classes: `element.classList.contains('class-name')`
- Check attributes: `element.getAttribute('data-foo')`
- Check text content: `element.textContent`


## Architecture

### Project Structure
- **src/t_prompts/**: Main package source code (src-layout)
  
### Key Constraints
- **Python Version**: Requires Python 3.14+ for t-strings (string.templatelib)
- **Dependency Management**: Uses UV exclusively; uv.lock is committed
- **Build System**: Uses Hatch/Hatchling for building distributions
- **Documentation Style**: NumPy docstring style (see mkdocs.yml:25)

### Core Types
TODO

### Design Principles

**Format Spec as Key Label**
- t-string format spec (`:label`) repurposed as dictionary key, NOT for formatting
- Key derivation: `format_spec` if non-empty, else `expression`
- Default `render()` ignores format spec; `render(apply_format_spec=True)` applies heuristically
- Rationale: t-strings defer format spec application; we prioritize key labeling for provenance

### Implementation Notes

**Python 3.14 t-strings** (core.py imports)
- Uses `string.templatelib.Template`, `Interpolation`, `convert`
- Template exposes `.strings` (static segments), `.interpolations` (metadata + values)
- Each Interpolation has: value, expression, conversion, format_spec
- Conversions applied via `string.templatelib.convert(value, conversion)` for !s/!r/!a

**Rendering Algorithm** (core.py:297-329)
- Interleave `Template.strings` with rendered interpolation values
- For each interpolation:
  1. Recursively render if value is StructuredPrompt
  2. Apply conversion (!s/!r/!a) via `convert()`
  3. Optionally apply format spec if `apply_format_spec=True` and spec looks like formatting
- Invalid format specs caught and ignored to preserve key semantics


### Testing Strategy

**No Mocks**
- Tests use real `string.templatelib.Template` objects from t-strings
- Rationale: library wraps pure data structures; no I/O, no need for mocks
- Ensures tests match actual Python 3.14 behavior

**Coverage Target**: ≥95% statements/branches

**Test Matrix** (tests/)
- **Happy paths** (test_core.py): Single/multiple interpolations, conversions (!s/!r/!a), nesting (2-3 levels), Mapping protocol
- **Edge cases** (test_edge_cases.py): Duplicate keys, whitespace in expressions, empty string segments, adjacent interpolations, format spec as key not formatting
- **Errors** (test_errors.py): Unsupported value types (int/list/dict/object), missing keys, empty expressions, non-nested indexing, TypeError for non-Template
- **Rendering** (test_rendering.py): f-string equivalence, apply_format_spec behavior, invalid format specs, nested rendering, conversions


### Code Standards
- **Ruff Configuration**:
  - Target: Python 3.14
  - Line length: 120 characters
  - Linting rules: E (pycodestyle errors), F (pyflakes), W (warnings), I (isort)
- **Type Hints**: Use throughout (string.templatelib types + typing)
- **Docstrings**: NumPy style, include Parameters, Returns, Raises sections

### Testing Configuration
- Test files must start with `test_` prefix
- Test classes must start with `Test` prefix
- Test functions must start with `test_` prefix
- Tests run with `-s` flag (no capture) by default
- Coverage reporting: use `--cov=src/t_prompts --cov-report=xml --cov-report=term`

**Visual Widget Tests**:
- Located in `tests/visual/` directory
- Use Playwright to render widgets in Chromium and verify correct rendering
- Marked with `@pytest.mark.visual` decorator
- Run by default unless explicitly skipped with `-m "not visual"`
- Require Chromium to be installed: `./scripts/setup-visual-tests.sh`
- Take screenshots that can be analyzed for verification
TODO -- explain utils and workflows
- Include 14 comprehensive tests covering all widget features

## Common Pitfalls

### JavaScript/Widget Development
- ❌ Don't `cd widgets && pnpm test` → ✅ Use `pnpm --filter @t-prompts/widgets test` from root
- ❌ Don't create test files in root → ✅ Use `scratchpad/` directory
- ❌ Don't modify `widgets/dist/` directly → ✅ Edit `src/` and rebuild
- ❌ Don't forget to run tests before building → ✅ Test → Build → Preview workflow
