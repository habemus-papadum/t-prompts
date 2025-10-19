# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Project Overview

This is a Python library called `t-prompts` (package name: `t-prompts`, module name: `t_prompts`) that provides structured prompts using template strings. The project is in early development stage and uses a modern Python toolchain.  There is also a library of Typescript UI widgets

## Quick Reference

All commands should be run from the project root unless otherwise specified.

### Setup
```bash
./scripts/setup.sh                                   # Complete setup (recommended for fresh clones)
uv sync --frozen                                     # Install Python dependencies only
pnpm install                                         # Install JavaScript dependencies only
./scripts/setup-visual-tests.sh                      # Install Playwright Chromium for visual tests
uv run pre-commit install                            # Set up git hooks
```

### Testing
```bash
uv run pytest                                        # Run all tests (includes visual tests)
uv run pytest -m "not visual"                        # Run only unit tests (skip visual tests)
uv run pytest -m visual                              # Run only visual tests
uv run pytest tests/test_example.py                  # Run specific test file
uv run pytest tests/test_example.py::test_version    # Run specific test function
./scripts/test_notebooks.sh                          # Test all demo notebooks (required after notebook changes)
./scripts/nb.sh docs/demos/01-basic.ipynb            # Run a single notebook
```

### Code Quality
```bash
uv run ruff check .                                  # Check Python code
uv run ruff format .                                 # Format Python code
uv run ruff check --fix .                            # Fix auto-fixable Python issues
pnpm --filter @t-prompts/widgets lint                # Check TypeScript code
pnpm --filter @t-prompts/widgets typecheck           # Type check TypeScript code
```

### JavaScript Widgets
```bash
pnpm --filter @t-prompts/widgets build:python        # Build widgets for Python integration
pnpm --filter @t-prompts/widgets test                # Run widget unit tests
pnpm --filter @t-prompts/widgets test lineWrap       # Run specific widget test
```

### Documentation
```bash
uv run mkdocs serve                                  # Serve docs locally (auto-reload)
uv run mkdocs build                                  # Build docs (executes notebooks)
```

### Scratchpad
- Use `scratchpad/` directory for temporary/test code (already in `.gitignore`)
- Example: `scratchpad/test_feature.py`, `scratchpad/output.html`

## Important Rules

### Version Management
**NEVER modify the version number in any file.** Version numbers are managed exclusively by humans. Do not change:
- `pyproject.toml` version field
- `src/t_prompts/__init__.py` `__version__` variable
- Any version references in documentation

If you think a version change is needed, inform the user but do not make the change yourself.

### Release Management
**ABSOLUTELY NEVER RUN THE RELEASE SCRIPT (`./scripts/release.sh`).** This is a production deployment script that:
- Publishes the package to PyPI (affects real users)
- Creates GitHub releases (public and permanent)
- Pushes commits and tags to the repository
- Triggers documentation deployment

**This script should ONLY be run by a human who fully understands the consequences.** Do not:
- Execute `./scripts/release.sh` under any circumstances
- Suggest running it unless the user explicitly asks about the release process
- Include it in automated workflows or scripts

If the user needs to make a release, explain the process but let them run the script themselves.

**Other release-related scripts** (also in `scripts/` folder):
- `scripts/pre-release.sh` - Pre-release validation checks
- `scripts/publish.sh` - Publish to PyPI (called by release.sh)
- **DO NOT run these manually** - they are part of the release automation

## Architecture

### Project Structure
- **src/t_prompts/**: Main package source code (src-layout)
- **widgets/**: TypeScript widgets for Jupyter/browser rendering
- **tests/**: Unit tests and visual tests
- **docs/**: Documentation and demo notebooks
- **scratchpad/**: Temporary/test code (gitignored)

### Key Constraints
- **Python Version**: Requires Python 3.14+ for t-strings (string.templatelib)
- **Dependency Management**: Uses UV exclusively; uv.lock is committed
- **Build System**: Uses Hatch/Hatchling for building distributions
- **Documentation Style**: NumPy docstring style (see mkdocs.yml:25)
- **Line Length**: 120 characters maximum (Python and TypeScript)

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

**Visual Widget Tests**
- Located in `tests/visual/` directory
- Use Playwright to render widgets in Chromium and verify correct rendering
- Marked with `@pytest.mark.visual` decorator
- Run by default unless explicitly skipped with `-m "not visual"`
- Require Chromium to be installed (see Quick Reference for setup command)
- Take screenshots that can be analyzed for verification
- Include 14 comprehensive tests covering all widget features

### Code Standards

**Python (Ruff Configuration)**:
- Target: Python 3.14
- Linting rules: E (pycodestyle errors), F (pyflakes), W (warnings), I (isort)
- Type Hints: Use throughout (string.templatelib types + typing)
- Docstrings: NumPy style, include Parameters, Returns, Raises sections

**TypeScript/JavaScript (ESLint Configuration)**:
- Use TypeScript throughout widget code
- Follow existing code style and patterns

**Testing Configuration**:
- Test files must start with `test_` prefix
- Test classes must start with `Test` prefix
- Test functions must start with `test_` prefix
- Tests run with `-s` flag (no capture) by default
- Coverage reporting: use `--cov=src/t_prompts --cov-report=xml --cov-report=term`

## Development Workflows

### Initial Setup

For a fresh clone, run the setup script (see Quick Reference). This handles:
1. Tool verification (uv, pnpm)
2. Python dependencies with frozen lockfile
3. JavaScript dependencies
4. TypeScript widget build
5. Pre-commit hook installation

The `--frozen` flag ensures reproducible builds. Pre-commit hooks automatically strip notebook outputs and check code quality before commits.

### Widget Development

**The project uses pnpm workspaces.** Always use `--filter @t-prompts/widgets` from the root directory. Never `cd` into subdirectories.

**Unit Testing Widgets**
- Widget code runs in browsers, but tests use `vitest` with `jsdom` to simulate the DOM
- Test file location: `widgets/src/**/*.test.ts` (next to the source file)
- Use `document.createElement()` to build test DOM structures
- Check classes with `element.classList.contains('class-name')`
- Check attributes with `element.getAttribute('data-foo')`
- See Quick Reference for test commands

**Example test structure**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { myTransform } from './myTransform';

describe('myTransform', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('should do something', () => {
    const span = document.createElement('span');
    span.setAttribute('data-chunk-id', 'chunk1');
    span.textContent = 'test';
    container.appendChild(span);

    expect(container.children.length).toBe(1);
    expect(span.textContent).toBe('test');
  });
});
```

### Visual Widget Changes

**Workflow 1: User as Eyes and Hands (Preferred)**
1. Write code with unit tests to validate logic
2. Build (see Quick Reference for build command)
3. User previews the changes in browser
4. User provides feedback via description or screenshot
5. Iterate on changes

**Workflow 2: Automated Screenshot Testing**
1. Write code with unit tests
2. Build (see Quick Reference)
3. Create Python test script in `scratchpad/` directory:
   ```python
   from t_prompts import prompt
   from t_prompts.widgets import Widget, save_widget_html

   @prompt
   def my_test():
       return "test content here"

   widget = Widget(my_test().compile())
   save_widget_html(widget, "scratchpad/output.html")
   ```
4. Run with: `uv run python scratchpad/my_test.py`
5. Check `src/t_prompts/widgets/preview.py` for additional screenshot/export capabilities

### Documentation Changes

**Demo Notebooks**
- After making any changes to demo notebooks in `docs/demos/*.ipynb`, you MUST lint
- Notebooks are stored **without outputs** in git (pre-commit hooks automatically strip them)
- During docs build, notebooks are executed to generate fresh outputs
- Do not consider notebook changes docs build

### Code Quality Workflow

When creating or modifying files:
1. Write/modify code
2. Run appropriate linter (see Quick Reference)
3. Fix any issues
4. Commit

This catches formatting issues, line length violations, and style problems early. Run linters incrementally as you work, not all at the end.

## Common Pitfalls

### Code Quality
- ❌ Don't skip linting after creating/modifying files → ✅ See Quick Reference for linting commands
- ❌ Don't ignore line length limits (120 chars) → ✅ Break long lines before committing
- ❌ Don't batch all linting until the end → ✅ Run linters incrementally as you work

### JavaScript/Widget Development
- ❌ Don't `cd widgets && pnpm test` → ✅ Use `pnpm --filter @t-prompts/widgets test` from root (see Quick Reference)
- ❌ Don't create test files in root → ✅ Use `scratchpad/` directory
- ❌ Don't modify `widgets/dist/` directly → ✅ Edit `src/` and rebuild (see Quick Reference)

### Testing
- ❌ Don't skip notebook tests after changes → ✅ Always run notebook test command (see Quick Reference)
- ❌ Don't forget visual tests need Chromium → ✅ Use setup command from Quick Reference if needed
