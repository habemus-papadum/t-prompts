# Diff Widget Audit

## Overview

This audit reviewed the algorithms that generate structured and rendered diff payloads in Python and the TypeScript components
that render those payloads. The goal was to confirm that the diff metadata remains faithful to the underlying prompt changes and
that the widgets present the data in an accessible way.

## Findings

### Equal chunk noise in rendered diff
- **Issue**: The rendered diff view attempted to skip `equal` operations but the implementation still appended them to the DOM.
- **Impact**: Equal chunks crowded the diff view with unchanged text, diluting the focus on inserts, deletes, and replaces.
- **Fix**: Filtered `equal` operations before rendering so only meaningful changes appear in the chunk list.

### Missing styling hooks for chunk operations
- **Issue**: Insert, delete, and replace operations in the rendered diff lacked the semantic CSS classes (`tp-diff-ins`,
  `tp-diff-del`) that the stylesheet and Python HTML renderer expect.
- **Impact**: Replaced lines rendered as plain text without color cues, and inserts/deletes could not be styled differently.
- **Fix**: Added the appropriate classes and separated replace operations into dedicated spans to mirror the Python renderer.

### Inconsistent representation of missing keys
- **Issue**: Structured diff nodes with a null key displayed the literal string `"null"`, diverging from the Python HTML output,
  which shows `"None"`.
- **Impact**: Users comparing Python and TypeScript renderings encountered inconsistent terminology for the root node.
- **Fix**: Normalized null/undefined keys to the string `"None"` before rendering titles.

## Validation

- Added Vitest suites for the structured and rendered diff views to confirm DOM structure, styling hooks, and stats rendering.
- Extended the Python diff tests to assert that widget payloads preserve chunk operation metadata, serialize attribute changes as
  lists, and keep root keys as `None` for TypeScript consumption.

## Follow-up Ideas

- Add DOM snapshots once the diff styling stabilizes to protect against accidental regressions.
- Consider enriching the rendered diff payload with per-element aggregates so the widget can surface a summary similar to the
  Python Rich output.
