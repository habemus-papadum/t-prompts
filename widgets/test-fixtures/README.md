# Test Fixtures

This directory contains JSON test fixtures used by the TypeScript widget tests.

## Overview

These fixtures are **generated files** created by the Python script `../generate_test_data.py`. They contain widget data in the exact format that the Python widget renderer produces, allowing TypeScript tests to verify rendering behavior without requiring a full Python runtime.

## Available Fixtures

| Fixture | File | Purpose |
|---------|------|---------|
| `long-text-240` | `long-text-240.json` | Single chunk with 240 'a' characters for testing line wrapping |
| `complex-wrap-test` | `complex-wrap-test.json` | Mixed content (intro + long text) to test wrapping heuristics |
| `demo-01` | `demo-01.json` | Comprehensive demo with markdown features (requires extras) |
| `tables` | `tables.json` | Multiple table interpolation patterns (cell, row, multi-row) |

## Regenerating Fixtures

When you modify the fixture generation logic or need to update fixtures:

```bash
# List all available fixtures
pnpm test:fixtures

# Regenerate all fixtures (overwrites existing)
pnpm test:fixtures:generate

# Regenerate specific fixtures
python3 ../generate_test_data.py long-text-240 tables --overwrite
```

## When to Regenerate

You should regenerate fixtures when:

1. The Python widget renderer output format changes
2. The t-prompts IR (intermediate representation) format changes
3. You add new test scenarios that require different fixture data
4. You modify the fixture generation logic in `generate_test_data.py`

## Adding New Fixtures

To add a new fixture:

1. Open `../generate_test_data.py`
2. Create a generator function (e.g., `generate_my_test()`)
3. Add a new entry to the `FIXTURES` dictionary
4. Run `pnpm test:fixtures:generate` to create the JSON file
5. Import and use the fixture in your TypeScript tests

## Dependencies

The fixture generator depends on:

- **Python 3.14+** (required for PEP 750 template string support)
- The `t_prompts` package (must be installed from `../../src/`)
- For demo fixtures: extras like `image` support
- `uv` package manager (recommended for Python 3.14 support)

## Tests Using These Fixtures

- `src/components/WidgetContainer.test.ts` - Uses `long-text-240.json`, `complex-wrap-test.json`
- `src/components/MarkdownView.test.ts` - Uses `demo-01.json`, `tables.json`

Each test file includes comments at the top indicating its dependency on generated fixtures.
