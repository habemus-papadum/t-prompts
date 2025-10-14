# Code Review — t-prompts

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
