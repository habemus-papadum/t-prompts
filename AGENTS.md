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
# Run all tests
uv run pytest

# Run a specific test file
uv run pytest tests/test_example.py

# Run a specific test function
uv run pytest tests/test_example.py::test_version
```

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

### Publishing
```bash
# Build and publish to PyPI (requires credentials)
./publish.sh
```

## Architecture

### Project Structure
- **src/t_prompts/**: Main package source code (src-layout)
  - `core.py`: StructuredPrompt, StructuredInterpolation classes + prompt() factory
  - `exceptions.py`: Custom exception classes
- **tests/**: Test suite using pytest (no mocks, real t-string Template objects)
  - `test_core.py`: Happy path tests
  - `test_edge_cases.py`: Edge cases (duplicates, whitespace, adjacency)
  - `test_errors.py`: Error conditions
  - `test_rendering.py`: Rendering behavior
  - `test_provenance.py`: Provenance tracking and export
- **docs/**: MkDocs documentation with mkdocstrings for API reference
  - `Architecture.md`: Detailed design document

### Key Constraints
- **Python Version**: Requires Python 3.14+ for t-strings (string.templatelib)
- **Dependency Management**: Uses UV exclusively; uv.lock is committed
- **Build System**: Uses Hatch/Hatchling for building distributions
- **Documentation Style**: NumPy docstring style (see mkdocs.yml:25)

### Core Types

**StructuredPrompt** (core.py:89-327)
- Wraps `string.templatelib.Template` from t-strings
- Implements `Mapping` protocol for dict-like access to interpolations
- Key methods: `render()`, `to_values()`, `to_provenance()`, `get_all()`
- Properties: `template`, `strings`, `interpolations`
- Preserves insertion order of interpolations

**StructuredInterpolation** (core.py:38-86)
- Immutable dataclass (frozen=True, slots=True) for one interpolation
- Fields: key, expression, conversion, format_spec, value, parent, index
- Supports nested navigation via `__getitem__` (delegates to nested StructuredPrompt)
- `render()` method applies conversions and renders nested prompts

### Design Principles

**Format Spec as Key Label**
- t-string format spec (`:label`) repurposed as dictionary key, NOT for formatting
- Key derivation: `format_spec` if non-empty, else `expression`
- Default `render()` ignores format spec; `render(apply_format_spec=True)` applies heuristically
- Rationale: t-strings defer format spec application; we prioritize key labeling for provenance

**Value Type Restriction**
- Only `str` or `StructuredPrompt` allowed as interpolation values
- Raises `UnsupportedValueTypeError` for int, list, dict, objects
- Prevents accidental `str(obj)` in prompts; explicit conversion required
- Enables type-safe prompt composition

**Key Uniqueness**
- Default: keys must be unique; raises `DuplicateKeyError` if collision
- `allow_duplicate_keys=True`: permits duplicates, use `get_all(key)` for access
- `__getitem__` with duplicates raises `ValueError` (ambiguous), must use `get_all()`

**Immutability**
- `StructuredInterpolation` is frozen dataclass
- `StructuredPrompt` internals not meant to be mutated after construction
- Enables safe sharing and caching

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

**Navigation** (core.py:70-78)
- `StructuredInterpolation.__getitem__` delegates to nested StructuredPrompt
- Enables chaining: `p['outer']['inner']['leaf']`
- Raises `NotANestedPromptError` if value is not StructuredPrompt

**Provenance Export** (core.py:331-373)
- `to_values()`: JSON-serializable dict of rendered values (nested dicts for nested prompts)
- `to_provenance()`: Full metadata including strings, nodes (key, expression, conversion, format_spec, index, value)
- Nested prompts recursively export provenance

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
- **Provenance** (test_provenance.py): to_values() structure, to_provenance() metadata, JSON serializability, parent references, roundtrip preservation

**Key Test Cases**
- Format spec that looks like formatting (e.g., `:05d`) treated as key by default
- Nested prompts render recursively and preserve provenance
- Expressions with whitespace (e.g., `{ foo }`) preserve whitespace in keys
- Empty expressions raise EmptyExpressionError
- All error messages include helpful context (expression, key, type)

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
