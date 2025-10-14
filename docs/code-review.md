# Code Review: t-prompts

## Overview
- Repository analyzed: `t-prompts`
- Review focus: code structure, test coverage quality, documentation alignment, and refactor readiness.
- Test suite execution: `uv run pytest` (215 tests, all passing).

## Strengths
- Comprehensive behavioural coverage across core features, including dedenting, render hints, and error handling, with real t-string objects instead of mocks.【F:tests/test_dedent.py†L1-L40】【F:tests/test_render_hints.py†L1-L159】
- Provenance utilities (`IntermediateRepresentation`, source mapping, provenance export) expose rich metadata for downstream tooling, keeping navigation, rendering, and provenance aligned.【F:src/t_prompts/core.py†L500-L600】【F:src/t_prompts/core.py†L1294-L1499】

## Key Findings & Recommendations

### 1. Source map offsets break when list interpolations use render hints
- **Issue**: When a `ListInterpolation` renders with `xml=` or `header` hints, the wrapper text is prepended after nested spans have already been recorded. The resulting spans no longer align with the rendered output (e.g., the first span for `<fruits>` points at `"<frui"`).【F:src/t_prompts/core.py†L1338-L1401】【3d37e0†L12-L16】
- **Impact**: Provenance consumers (e.g., token accounting, editors) receive incorrect offsets for every list item, undermining a core library promise.
- **Tests**: Existing tests assert string output only and miss this regression.【F:tests/test_render_hints.py†L85-L109】
- **Recommendation**:
  - Update list rendering to offset nested spans after wrappers are applied (e.g., accumulate the prefix and adjust each collected span before appending to `source_map`).
  - Add regression tests in `tests/test_source_mapping.py` that cover `ListInterpolation` with `xml=`/`header` hints to validate span alignment.

### 2. Documentation drift around render hints and project layout
- README still claims render hints are "stored but not currently applied", despite `StructuredPrompt.render()` honoring `xml=` and `header` hints in production.【F:README.md†L225-L255】【F:src/t_prompts/core.py†L1378-L1469】
- Architecture document references a `utils.py` module and states format specs are never applied as formatting directives, which predates render-hint execution and the current module layout.【F:docs/Architecture.md†L377-L445】
- **Recommendation**: Refresh README, architecture docs, and notebooks to document current behaviour (hint execution, `ListInterpolation`, `ImageInterpolation`) and remove stale module references. Flag differences explicitly so downstream users know render hints mutate output.

### 3. `_process_dedent` contract mismatch
- Docstring promises a `DedentError` when `trim_leading=True` but the first line lacks the expected newline pattern; the implementation silently leaves the string untouched instead of raising.【F:src/t_prompts/core.py†L144-L200】
- **Impact**: Users cannot rely on the documented error semantics, and tests do not cover this branch.
- **Recommendation**: Decide whether to update behaviour (raise when documented) or relax the docstring/tests to reflect current tolerant logic. Either change requires test updates in `tests/test_dedent.py` to capture the intended contract.

### 4. Monolithic `core.py` hampers maintainability
- Nearly all functionality—including dataclasses, hint parsing, dedent logic, rendering, and provenance—is implemented in a single 1.5k-line module, increasing merge conflict risk and hiding duplicated logic (e.g., hint application across lists and single interpolations).【F:src/t_prompts/core.py†L144-L1499】
- **Recommendation**: Extract focused modules (e.g., `dedent.py`, `hints.py`, `elements.py`, `rendering.py`, `ir.py`) so related tests and documentation can track each layer independently. This also clarifies where duplicated hint logic could be centralised.

### 5. Provenance tests could be deeper
- Tests validate formatting and high-level provenance, but they do not assert span alignment for render hints or image/list combinations, allowing regressions like Finding 1 to slip through.【F:tests/test_render_hints.py†L85-L159】【F:tests/test_source_mapping.py†L1-L200】
- **Recommendation**: Extend `tests/test_source_mapping.py` (or add a new module) with explicit assertions on `SourceSpan` coordinates for:
  - Lists with separators, headers, and XML hints.
  - Mixed text/image prompts to guard `ImageRenderError` and chunk accounting once multi-modal rendering is introduced.

## Proposed Modularisation & Refactor Plan

1. **Preparation**
   - Update documentation to describe current behaviour (render hints, optional image support) before moving code so reviewers can validate intent.【F:README.md†L225-L320】【F:docs/Architecture.md†L377-L460】
   - Add missing provenance tests for list render hints (Finding 1) so refactors are gated by accurate expectations.

2. **Introduce parsing utilities module**
   - Extract `_parse_format_spec`, `_parse_render_hints`, `_parse_separator`, and related constants into `src/t_prompts/hints.py`.
   - Update imports in `core.py` (future `rendering.py`) and corresponding tests.
   - Run `uv run pytest` to confirm no behavioural drift.

3. **Isolate dedent processing**
   - Move `_process_dedent` (and any dedent-specific exceptions) into `src/t_prompts/dedent.py`.
   - Adjust docstrings/tests once the DedentError contract is clarified (Finding 3).
   - Re-run tests and regenerate any doc snippets that embed dedent examples.

4. **Split element dataclasses**
   - Create `src/t_prompts/elements.py` housing `Element`, `Static`, `StructuredInterpolation`, `ListInterpolation`, `ImageInterpolation`, and associated helper methods.
   - Ensure serialization/provenance tests import from the new module where appropriate.

5. **Separate intermediate representation**
   - Move `IntermediateRepresentation`, `TextChunk`, `ImageChunk`, and `SourceSpan` into `src/t_prompts/intermediate.py`.
   - Update UI helpers (`src/t_prompts/ui.py`) and any tests referencing these classes.

6. **Rebuild `StructuredPrompt` in a slimmer `rendering.py`**
   - Limit the module to prompt construction, rendering, and provenance export.
   - While doing so, deduplicate hint handling between single and list interpolations (consider helper functions in `hints.py`).
   - Fix the span offset bug as part of this extraction.

7. **Public API consolidation**
   - Update `src/t_prompts/__init__.py` to re-export from the new modules without changing the external API.
   - Maintain backwards compatibility tests to ensure imports still work.

8. **Documentation & notebook sync**
   - After code moves, refresh README, architecture docs, and demos to reference the new module layout and corrected behaviour (render hints mutate output, source map accuracy for lists/images).
   - Execute `./test_notebooks.sh` to validate demo notebooks if modified.

9. **Regression verification**
   - Run `uv run pytest` and targeted provenance tests to confirm span accuracy.
   - Consider adding coverage thresholds focused on the new modules to prevent future regressions.

## Validation Checklist
- ✅ `uv run pytest` (already executed during review)【4dbd8b†L1-L16】
- After refactor steps: rerun `uv run pytest` and `./test_notebooks.sh` (if notebooks change) to ensure consistency.

