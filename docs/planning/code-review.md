# Code Review: t-prompts - Expert 1

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


-----------------

# Code Review — t-prompts. -- Expert #2

_Date: 2025-03-17_

## Executive Summary
- `src/t_prompts/core.py` now mixes low-level helpers, element dataclasses, rendering, provenance export, and the public factory API in a single 1,600+ line module, which makes the control flow difficult to follow and encourages duplicated logic (for example the header/XML wrapping code in both the list and scalar rendering branches).【F:src/t_prompts/core.py†L144-L200】【F:src/t_prompts/core.py†L725-L1512】【F:src/t_prompts/core.py†L1369-L1477】【F:src/t_prompts/core.py†L1563-L1660】
- The automated test suite runs against real t-string `Template` objects and covers the newer features such as render hints, source mapping, and image interpolation, so coverage is meaningful, but a few recently added branches (e.g., list handling in `to_values()`/`to_provenance()`) are still untested and could regress silently during refactors.【801216†L1-L16】【F:tests/test_render_hints.py†L10-L346】【F:tests/test_source_mapping.py†L6-L200】【F:tests/test_image_interpolation.py†L36-L200】【F:src/t_prompts/core.py†L1501-L1544】
- Documentation has drifted: the architecture document still claims render hints are stored but unused even though the code now emits markdown headers and XML wrappers, and the README does not mention the richer hint semantics, so external readers will receive outdated guidance.【F:docs/Architecture.md†L69-L103】【F:src/t_prompts/core.py†L1378-L1457】【F:README.md†L67-L125】
- Before breaking the monolith apart, add a few targeted regression tests (especially for list provenance/value export and documentation examples) so that a staged 3–5 module refactor can be executed without losing behavior.【F:src/t_prompts/core.py†L1501-L1544】【F:tests/test_provenance.py†L8-L160】

## Code Structure Observations
### Monolithic module
`core.py` currently owns everything: helper utilities (`_process_dedent`, `_parse_format_spec`, `_parse_render_hints`), source location capture, element dataclasses, the rendering pipeline, provenance exporters, and the `prompt`/`dedent` factory functions.【F:src/t_prompts/core.py†L144-L412】【F:src/t_prompts/core.py†L606-L1660】
This design emerged organically but now obscures boundaries:
- Pure functions such as `_process_dedent` and `_parse_render_hints` could live in a lightweight `parsing`/`text` module, yet they sit next to rendering code despite not needing class context.【F:src/t_prompts/core.py†L144-L412】
- Data containers (`SourceLocation`, `SourceSpan`, `Element` subclasses) and behavioral types (`StructuredPrompt`, `IntermediateRepresentation`) share a file, making it harder to reason about serialization versus rendering responsibilities.【F:src/t_prompts/core.py†L42-L704】【F:src/t_prompts/core.py†L984-L1520】
- `_capture_source_location` depends on the package layout to filter stack frames; moving code later without considering this will change its behavior, so it deserves an isolated module with explicit tests.【F:src/t_prompts/core.py†L97-L142】

### Rendering duplication
The list interpolation branch and the scalar interpolation branch inside `StructuredPrompt.render()` both apply header/XML hints and adjust source spans in nearly identical ways, which is a code smell and a maintenance hazard.【F:src/t_prompts/core.py†L1369-L1398】【F:src/t_prompts/core.py†L1403-L1477】 Any future change to hint semantics must be updated twice. Extracting a helper that wraps text and returns the length delta would eliminate this duplication and simplify upcoming module moves.

### Export helpers need tests
`StructuredPrompt.to_values()` and `to_provenance()` recently gained support for list interpolations, but there are no regression tests covering the list path or image metadata serialization.【F:src/t_prompts/core.py†L1501-L1544】【F:tests/test_provenance.py†L8-L160】 Adding fixture-driven expectations for these branches will prevent accidental removal when the code is rearranged.

### Optional dependency guardrails
The `HAS_PIL` flag is computed at import time and gates both construction and rendering of `ImageInterpolation` nodes.【F:src/t_prompts/core.py†L33-L40】【F:src/t_prompts/core.py†L1092-L1144】 Because `core.py` performs the import up front, re-organizing modules must preserve that import order (or lazily import Pillow) to avoid changing runtime behavior. Keeping the optional dependency logic in a dedicated module (e.g., `media.py`) would make this contract explicit.

## Testing Assessment
- Running `uv run pytest` currently executes 215 real tests without mocks, covering render hints, dedent options, source mapping, and image handling, so the suite gives meaningful feedback for behavior-level changes.【801216†L1-L16】【F:tests/test_render_hints.py†L10-L346】【F:tests/test_dedent.py†L1-L200】【F:tests/test_source_mapping.py†L6-L200】【F:tests/test_image_interpolation.py†L36-L200】
- The hint tests demonstrate that markdown headers, XML wrappers, and separator hints are asserted end-to-end via `str()` rendering, so they will catch regressions when extracting renderer code.【F:tests/test_render_hints.py†L230-L346】
- Source mapping tests exercise `IntermediateRepresentation` span lookups across nested prompts, so moving that class out of `core.py` is low risk as long as interfaces stay stable.【F:tests/test_source_mapping.py†L6-L200】
- Gaps: `to_values()`/`to_provenance()` lack coverage for list outputs and image metadata, leaving those sections vulnerable during refactors; similarly, no test locks down `prompt(..., capture_source_location=False)` interactions, yet `_capture_source_location` relies on module layout.【F:src/t_prompts/core.py†L97-L142】【F:src/t_prompts/core.py†L1501-L1544】【F:tests/test_provenance.py†L8-L160】 Adding focused tests for these areas is recommended before structural changes.

## Documentation & Demo Drift
- The architecture document still states that render hints are "stored but not currently applied" even though `StructuredPrompt.render()` now emits headers and XML wrappers based on hints; this mismatch can confuse contributors trying to understand expected output.【F:docs/Architecture.md†L69-L103】【F:src/t_prompts/core.py†L1378-L1457】
- The README explains separators but omits the new header/XML semantics, so end users are unaware of how to leverage the hint system beyond custom separators.【F:README.md†L67-L125】
- Demo notebooks should be audited to confirm they showcase header/XML hints and image behavior once documentation is updated; otherwise tutorial readers will miss current capabilities.

## Suggested Refactor Plan (3–5 modules)
1. **Expand regression coverage.**
   - Add tests for list/image branches in `to_values()` and `to_provenance()` plus a test that disables source-location capture to guard `_capture_source_location` behavior.【F:src/t_prompts/core.py†L97-L142】【F:src/t_prompts/core.py†L1501-L1544】
   - Update demo notebooks/README examples to include header/XML usage and ensure `test_notebooks.sh` runs cleanly.
2. **Extract stateless helpers.**
   - Move `_process_dedent`, `_parse_format_spec`, `_parse_separator`, and `_parse_render_hints` into a new `parsing.py` (or `text.py`). Adjust imports and rely on the new tests to verify no behavior changed.【F:src/t_prompts/core.py†L144-L412】
3. **Isolate data models.**
   - Create an `elements.py` (or `model.py`) that holds `SourceLocation`, `SourceSpan`, `Element`/`Static`/`StructuredInterpolation`/`ListInterpolation`/`ImageInterpolation`. Keep UUID creation and metadata handling here.【F:src/t_prompts/core.py†L42-L1144】
   - Ensure `_capture_source_location` moves alongside `SourceLocation` so stack filtering keeps working.
4. **Split rendering/export logic.**
   - Move `IntermediateRepresentation` and `StructuredPrompt.render()` (plus helper methods) into `rendering.py`, introducing small shared utilities for header/XML wrapping to remove duplication.【F:src/t_prompts/core.py†L606-L1482】
   - Keep export helpers (`to_values`, `to_provenance`) with `StructuredPrompt` or relocate them to a dedicated `export.py` depending on cohesion.
5. **Define a slim public API module.**
   - Add `api.py` (or keep `core.py` as a façade) that exposes `prompt`/`dedent` and re-exports the main classes, minimizing import churn for users. Update `src/t_prompts/__init__.py` accordingly.
   - After each move, run `uv run pytest` and `./test_notebooks.sh`, then refresh README and architecture docs to align with the new module layout and feature set.

Following this staged plan keeps changes incremental, maintains documentation parity, and reduces the risk of breaking call sites while achieving the desired 3–5 module structure.
