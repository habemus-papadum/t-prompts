# Dedent Support Implementation Plan

## Overview
Add dedenting support to the `prompt()` function to make source code more readable by allowing indented t-strings that are automatically dedented during processing.

## Key Design Decisions

### 1. **Dedent Processing Happens at Construction Time**
- Modify `_build_nodes()` in `StructuredPrompt.__init__()` to process strings before creating Static elements
- Original template strings remain unchanged (provenance preserved)
- Dedented strings stored in Static elements
- **Impact**: Source mapping remains accurate - spans point to dedented text

### 2. **Three Processing Steps (All Opt-In/Opt-Out)**
1. **Remove leading line** (default: ON, controlled by `trim_leading=True`)
   - First line of first static must end in `\n` and contain only whitespace
   - This line is completely removed

2. **Remove empty leading lines** (default: ON, controlled by `trim_empty_leading=True`)
   - After removing first line, remove any subsequent lines that are empty (just `\n`)
   - Helps with blank line for readability

3. **Remove trailing empty lines** (default: ON, controlled by `trim_trailing=True`)
   - In the last static segment, remove trailing lines that are just `\n`
   - Applied to the final static (after last interpolation)

4. **Dedent** (default: OFF, controlled by `dedent=True`)
   - Find first non-empty line across all statics
   - Count leading spaces to determine indent level
   - Remove that many spaces from the start of every line in all statics

### 3. **New Parameters to `prompt()`**
```python
def prompt(
    template: Template,
    /,
    *,
    dedent: bool = False,
    trim_leading: bool = True,
    trim_empty_leading: bool = True,
    trim_trailing: bool = True,
    **opts
) -> StructuredPrompt:
```

### 4. **Source Mapping Behavior**
- SourceSpans map to the **dedented** text (what's actually rendered)
- Original strings preserved in `template.strings` for provenance
- This is consistent with how conversions work (!r changes the text)
- **Not a problem**: Users care about the rendered output, not the indented source

### 5. **Error Handling**
- If `trim_leading=True` but first line doesn't match pattern: raise `ValueError`
- If `dedent=True` but no non-empty lines found: proceed with no dedenting
- If tabs and spaces mixed in indent: raise `ValueError` (consistent with textwrap.dedent philosophy)

## Implementation Steps

### Phase 1: Core Infrastructure (New Function)
**File**: `src/t_prompts/core.py`

Create `_process_dedent()` function:
```python
def _process_dedent(
    strings: tuple[str, ...],
    *,
    dedent: bool,
    trim_leading: bool,
    trim_empty_leading: bool,
    trim_trailing: bool
) -> tuple[str, ...]:
    """Process dedenting and trimming on template strings."""
```

This function:
1. Validates first line if `trim_leading=True`
2. Removes leading whitespace line
3. Removes empty leading lines if enabled
4. Removes trailing empty lines if enabled
5. Calculates indent level if `dedent=True`
6. Dedents all lines

### Phase 2: Integration
**File**: `src/t_prompts/core.py`

Modify:
1. `prompt()` signature - add new parameters
2. Pass dedent parameters to `StructuredPrompt.__init__()`
3. Store dedent settings in `StructuredPrompt` (for reference)
4. Call `_process_dedent()` in `_build_nodes()` before creating Static elements

### Phase 3: Tests
**File**: `tests/test_dedent.py` (new file)

Test categories:
1. **Basic dedenting** - simple indented strings
2. **Trim leading** - first line removal
3. **Trim empty leading** - blank line removal after first line
4. **Trim trailing** - trailing newline removal
5. **All features combined** - realistic use case
6. **Edge cases**:
   - Empty first static
   - Only interpolations (no statics to dedent)
   - Mixed tabs/spaces (should error)
   - First line invalid format (should error)
   - No non-empty lines (dedent does nothing)
   - Nested prompts with dedenting
7. **Source mapping** - verify spans point to dedented text
8. **Provenance** - verify original strings preserved

### Phase 4: Documentation
**Files**:
- `README.md` - Add "Dedenting for Readability" section with examples
- `docs/architecture.md` - Document dedenting behavior and rationale
- `docs/demos/topics/dedenting.ipynb` - New notebook with examples

### Phase 5: Error Cases
**File**: `src/t_prompts/exceptions.py`

Add new exception:
```python
class DedentError(StructuredPromptsError):
    """Raised when dedenting configuration is invalid."""
```

## Edge Cases to Handle

### 1. **Empty First Static**
```python
p = prompt(t"{x:x} indented text", dedent=True)
```
- First static is "", skip trim_leading check
- Find indent level in second static

### 2. **Interpolation in First Line**
```python
p = prompt(t"
    Hello {name:n}
    How are you?
", dedent=True)
```
- First line (before `Hello`) should be removed
- Dedent applies to remaining lines

### 3. **No Statics (Only Interpolations)**
```python
p = prompt(t"{a:a}{b:b}", dedent=True)
```
- All statics are empty, dedenting does nothing
- No error, just no effect

### 4. **Nested Prompts**
```python
p_inner = prompt(t"
    nested content
", dedent=True)
p_outer = prompt(t"
    Outer: {p_inner:inner}
", dedent=True)
```
- Each prompt dedents independently
- Inner prompt dedented before being interpolated into outer

### 5. **Mixed Content**
```python
p = prompt(t"
    Line 1
    {items:items}
    Line 3
", dedent=True)
```
- Dedent applies to all static segments
- Each static gets the same indent level removed

## Example Transformation

### Input (with dedent=True):
```python
prompt(t"""
    You are a helpful assistant.

    Context: {context:ctx}
    Task: {task:t}

    Please respond.
""", dedent=True)
```

### Processing Steps:
1. **Trim leading**: Remove first line (just `\n`)
2. **Trim empty leading**: Remove empty line after first line
3. **Calculate indent**: First non-empty line has 4 spaces
4. **Dedent**: Remove 4 spaces from each line
5. **Trim trailing**: Remove final `\n`

### Result:
```
You are a helpful assistant.

Context: {context}
Task: {task}

Please respond.
```

## Source Mapping Implications

The source mapping points to the **dedented** text, which is correct because:
1. Users want to find positions in the **rendered** output
2. Consistent with how conversions work (!r changes text)
3. The dedented version is what appears in `IntermediateRepresentation.text`
4. Original strings still available via `prompt.template.strings` for debugging

## Backward Compatibility

- **All dedent features OFF by default** (except trims which are ON)
- Existing code works exactly the same
- No breaking changes
- Opt-in feature with explicit `dedent=True`

## Testing Strategy

Minimum 30 new tests covering:
- Each feature independently
- Combinations of features
- All edge cases listed above
- Error conditions
- Source mapping verification
- Nested prompts
- Integration with existing features (conversions, format specs, etc.)
