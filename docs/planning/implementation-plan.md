# Implementation Plan for Code Review Recommendations

## Overview
This plan implements all recommendations from the expert code review, addressing:
1. **Critical bug**: Source map offset errors with list interpolations + render hints
2. **Documentation drift**: Outdated README and architecture docs
3. **Code quality**: Monolithic core.py refactoring into focused modules
4. **Test gaps**: Missing coverage for provenance and edge cases
5. **Contract issues**: `_process_dedent` docstring mismatch

## Phase 1: Preparation & Bug Fixes (Critical)

### 1.1 Fix Source Map Offset Bug for List Interpolations
**Issue**: When `ListInterpolation` uses `xml=` or `header` hints, wrapper text is added AFTER spans are recorded, causing misalignment.

**Location**: `src/t_prompts/core.py:1338-1401`

**Fix Approach**:
- Collect all nested spans first (lines 1358-1367)
- Calculate `prefix_len` from hints (lines 1379-1394)
- **Before appending to source_map**, adjust each span's start/end by `prefix_len`
- This ensures spans point to correct positions in final output

**Test Addition**: Add to `tests/test_source_mapping.py`:
- Test list with `xml=` hint validates span coordinates
- Test list with `header` hint validates span coordinates
- Test list with both hints validates span coordinates

### 1.2 Add Missing Test Coverage

**Add to `tests/test_provenance.py`**:
- Test `to_values()` with `ListInterpolation`
- Test `to_values()` with nested prompts in lists
- Test `to_provenance()` with `ListInterpolation`
- Test `to_provenance()` with `ImageInterpolation` metadata

**Add to `tests/test_source_location.py`**:
- Test `capture_source_location=False` behavior
- Test that disabling doesn't break rendering

### 1.3 Fix `_process_dedent` Contract Mismatch
**Issue**: Docstring says it raises `DedentError` when `trim_leading=True` but first line doesn't match pattern, but code silently continues.

**Decision Needed** (will choose tolerant approach):
- Update docstring to reflect current behavior (tolerant, no error)
- Add test in `tests/test_dedent.py` that validates non-raising behavior

## Phase 2: Documentation Updates

### 2.1 Update README.md
- Remove claim that render hints are "stored but not applied"
- Document that `xml=` and `header` hints actively transform output
- Add examples of render hints in action
- Document `ListInterpolation` and `ImageInterpolation`
- Update feature list to show current capabilities

### 2.2 Update docs/Architecture.md
- Remove references to non-existent `utils.py`
- Document current module structure (`core.py`, `exceptions.py`, `ui.py`)
- Explain render hint execution and how it modifies output
- Update to reflect multi-modal support (TextChunk/ImageChunk)
- Document source location tracking

### 2.3 Update Demo Notebooks
- Add examples showing render hints (`xml=`, `header`)
- Ensure `docs/demos/topics/render-hints.ipynb` is comprehensive
- Verify all notebooks execute with `./test_notebooks.sh`

## Phase 3: Module Refactoring (Breaking Monolith)

### 3.1 Extract Parsing Utilities → `src/t_prompts/parsing.py`
**Move from core.py**:
- `_parse_format_spec()` (lines 297-332)
- `_parse_separator()` (lines 335-359)
- `_parse_render_hints()` (lines 362-410)

**Updates**:
- Update imports in `core.py` (and future `rendering.py`)
- Run tests to ensure no behavioral changes

### 3.2 Extract Dedent Logic → `src/t_prompts/text.py`
**Move from core.py**:
- `_process_dedent()` (lines 144-294)
- Related dedent logic

**Updates**:
- Fix docstring per Phase 1.3
- Update imports in `core.py`
- Ensure `tests/test_dedent.py` still passes

### 3.3 Extract Element Dataclasses → `src/t_prompts/elements.py`
**Move from core.py**:
- `SourceLocation` (lines 42-94)
- `_capture_source_location()` (lines 97-141) - **Must move with SourceLocation**
- `Element` base class (lines 724-753)
- `Static` (lines 756-777)
- `StructuredInterpolation` (lines 780-865)
- `ListInterpolation` (lines 868-937)
- `ImageInterpolation` (lines 940-981)

**Critical**: Keep `_capture_source_location` with `SourceLocation` since it depends on package layout

### 3.4 Extract Intermediate Representation → `src/t_prompts/ir.py`
**Move from core.py**:
- `TextChunk` (lines 413-427)
- `ImageChunk` (lines 430-446)
- `SourceSpan` (lines 449-479)
- `IntermediateRepresentation` class (lines 482-721)

**Updates**:
- Update `ui.py` imports
- Update test imports in `test_source_mapping.py`, `test_bidirectional_lookup.py`

### 3.5 Create Rendering Module → `src/t_prompts/rendering.py`
**Move from core.py**:
- `StructuredPrompt` class (lines 984-1560)
- `prompt()` function (lines 1563-1660)
- `dedent()` function (lines 1663-1727)

**Deduplicate render hint logic**:
- Extract common hint wrapping logic into helper function in `parsing.py`:
  ```python
  def apply_render_hints(
      text: str,
      hints: dict[str, str],
      header_level: int,
      max_header_level: int
  ) -> tuple[str, int]:
      """Apply render hints and return (wrapped_text, prefix_len)"""
  ```
- Use this helper in both list and scalar interpolation rendering
- Fixes the duplication issue (lines 1369-1401 vs 1403-1477)

### 3.6 Update Public API → `src/t_prompts/__init__.py`
**Consolidate re-exports**:
- Import from new modules (`parsing`, `text`, `elements`, `ir`, `rendering`)
- Maintain backward compatibility (all existing imports still work)
- Add backward compatibility tests

**Keep `core.py` or remove**:
- Option A: Delete `core.py` entirely after moves
- Option B: Keep as thin façade for backward compatibility
- **Recommendation**: Delete it to force clean imports

### 3.7 Optional Dependency Module → `src/t_prompts/media.py`
**Extract PIL handling**:
- Move `HAS_PIL` flag and PIL import (lines 33-39)
- Lazy import strategy to preserve import order
- Update `ImageInterpolation` to import from `media.py`

## Phase 4: Verification & Polish

### 4.1 Run Full Test Suite
- `uv run pytest` - all tests must pass
- `./test_notebooks.sh` - all notebooks must execute
- `uv run ruff check .` - no linting issues

### 4.2 Add Regression Tests
- Source map accuracy for lists with hints (Phase 1.1)
- Provenance export for lists and images (Phase 1.2)
- Documentation examples execute correctly

### 4.3 Update Remaining Documentation
- API reference in `docs/reference.md`
- Update any inline code examples
- Ensure architecture doc reflects new module structure

## Execution Order (Staged Approach)

### Stage 1: Critical Fixes (Do First)
1. Fix source map offset bug (1.1)
2. Add missing test coverage (1.2)
3. Fix dedent contract (1.3)
4. Update documentation (2.1-2.3)
5. **Verify**: `uv run pytest && ./test_notebooks.sh`

### Stage 2: Module Extraction (Sequential)
1. Extract `parsing.py` (3.1) → test
2. Extract `text.py` (3.2) → test
3. Extract `elements.py` (3.3) → test
4. Extract `ir.py` (3.4) → test
5. Extract `rendering.py` with deduplication (3.5) → test
6. Update `__init__.py` (3.6) → test
7. Optional: Extract `media.py` (3.7) → test

### Stage 3: Final Verification
1. Run all tests (4.1)
2. Add regression tests (4.2)
3. Final documentation pass (4.3)

## Expected Outcomes

**After Stage 1**:
- ✅ Source maps are accurate for all render hint combinations
- ✅ Test coverage for all export paths
- ✅ Documentation matches actual behavior
- ✅ All 215+ tests passing

**After Stage 2**:
- ✅ 5-7 focused modules instead of monolithic `core.py`
- ✅ No code duplication in render hint handling
- ✅ Clear separation: parsing, elements, rendering, IR
- ✅ Maintainable structure for future features

**After Stage 3**:
- ✅ Comprehensive regression protection
- ✅ Up-to-date documentation across all formats
- ✅ Clean, professional codebase ready for growth

## Risk Mitigation

- **Each module extraction is tested immediately** before moving to next
- **Backward compatibility maintained** in `__init__.py`
- **Progressive enhancement**: Can stop after Stage 1 if needed
- **Rollback points**: Each stage can be committed separately

## Files Modified Summary

**Stage 1** (8 files):
- `src/t_prompts/core.py` (bug fix)
- `tests/test_source_mapping.py` (new tests)
- `tests/test_provenance.py` (new tests)
- `tests/test_source_location.py` (new tests)
- `tests/test_dedent.py` (new test)
- `README.md` (updates)
- `docs/Architecture.md` (updates)
- Demo notebooks (examples)

**Stage 2** (13 files):
- `src/t_prompts/parsing.py` (new)
- `src/t_prompts/text.py` (new)
- `src/t_prompts/elements.py` (new)
- `src/t_prompts/ir.py` (new)
- `src/t_prompts/rendering.py` (new)
- `src/t_prompts/media.py` (new, optional)
- `src/t_prompts/__init__.py` (updates)
- `src/t_prompts/core.py` (delete or reduce to façade)
- `src/t_prompts/ui.py` (update imports)
- All test files (update imports as needed)

**Stage 3** (3 files):
- Additional regression tests
- Final documentation polish
- API reference updates
