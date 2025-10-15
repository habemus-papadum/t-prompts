# t-prompts — Architecture & Implementation Plan

**Target Python:** 3.14+ (uses new template string literals / t-strings)
**Status:** Design document (v1)

## 1) High-level description & motivation

`t-prompts` is a tiny Python library that turns t-strings (`t"..."`) into a provenance-preserving, navigable tree we call a `StructuredPrompt`. It lets you:

- Render to a plain string (like an f-string), and
- Retain the full origin of each interpolated value (original expression text, optional conversion flag, and format spec), so you can inspect and address parts of a composed prompt after the fact.

This is enabled by Python 3.14's template string literals, which produce a `Template` object with:

- the static string segments (`.strings`)
- a tuple of `Interpolation` objects (`.interpolations`) carrying:
  - `value` (the evaluated object)
  - `expression` (the source text inside `{}`),
  - `conversion` (e.g., `!r`/`!s`/`!a`),
  - `format_spec` (arbitrary string following `:`)

*Python documentation*

Unlike f-strings, t-strings return structure rather than a `str`, leaving it to libraries like this one to decide how to use conversions and format specs.

*Python documentation*

### Why this matters for LLM work

- **Traceability / reproducibility:** Knowing which expression produced a given span is crucial when post-processing, auditing, or debugging prompts.
- **Structured access:** Address nested pieces (`p2['p']['inst']`) to edit, log, or feed into tools.
- **Composable:** Interpolations can be strings or other `StructuredPrompt`s, enabling trees of prompt fragments that can still be rendered and inspected as a whole.

## 2) User-facing syntax (examples)

```python
from t_prompts import prompt

instructions = "Always answer politely."
p = prompt(t"Obey {instructions:inst}")

assert str(p) == "Obey Always answer politely."
# Index into provenance:
node = p['inst']             # -> StructuredInterpolation
assert node.expression == "instructions"
assert node.value == "Always answer politely."
```

**Nesting (compose prompts):**

```python
from t_prompts import prompt

instructions = "Always answer politely."
foo = "bar"

p  = prompt(t"Obey {instructions:inst}")
p2 = prompt(t"bazz {foo} {p}")

assert str(p2) == "bazz bar Obey Always answer politely."
# Navigate the tree:
assert isinstance(p2['p'], t_prompts.StructuredInterpolation)
assert isinstance(p2['p'].value, t_prompts.StructuredPrompt)
assert p2['p']['inst'].value == "Always answer politely."
```

**Keying rule (Format Spec Mini-Language):**

Format specs follow the pattern `key : render_hints`:

- **No format spec**: `{var}` → key = `"var"` (uses expression)
- **Underscore**: `{var:_}` → key = `"var"` (explicitly uses expression)
- **Simple key**: `{var:custom_key}` → key = `"custom_key"` (trimmed), no hints
- **With hints**: `{var:key:hint1:hint2}` → key = `"key"` (trimmed), hints = `"hint1:hint2"`

The first colon separates the key from optional render hints. Keys are trimmed of leading/trailing whitespace while preserving internal spaces. Multiple colons split only on the first, with everything after becoming render hints.

**Supported render hints** (actively applied during rendering):
- `xml=<tag>`: Wraps content in XML tags: `<tag>content</tag>`
- `header` or `header=<text>`: Prepends markdown header (e.g., `# Header`)
- `sep=<separator>`: Custom separator for list interpolations (default: `\n`)

*Python documentation*

## 3) Core concepts & data model

### 3.1 Types

**StructuredPrompt**

- Wraps a `string.templatelib.Template` (the original t-string structure). *Python documentation*
- Dict-like access to `StructuredInterpolation` nodes.
- Preserves ordering of interpolations.
- Renders to `IntermediateRepresentation` with source mapping, applying conversion semantics.

**StructuredInterpolation**

Immutable record of one interpolation occurrence:

- `key: str` — derived from format spec mini-language
- `expression: str` — original expression text (from t-string)
- `conversion: Literal['a','r','s'] | None`
- `format_spec: str` — preserved verbatim from t-string
- `render_hints: str` — extracted hints from format spec (e.g., `"hint1:hint2"`)
- `value: str | StructuredPrompt`
- `parent: StructuredPrompt | None`
- `index: int` — position among interpolations

Dict-like delegation when value is a `StructuredPrompt`:

- `node['inst']` → look into child prompt and return its interpolation node.

**IntermediateRepresentation**

Intermediate representation of a `StructuredPrompt`, providing text and source mapping. The name reflects that this is not necessarily the final output sent to an LLM, but rather a structured intermediate form that can be further processed, optimized, or transformed.

**Rationale for naming**: This object serves as the ideal representation for structured prompt optimization. When approaching context limits, you want to reduce prompts in a structured way—potentially deleting specific parts. The `IntermediateRepresentation` helps debug and implement these optimization strategies with full provenance tracking.

Additionally, for future multi-modal support (e.g., interpolating images), the mapping from a "rendered prompt" to a single user message will no longer be accurate. Instead, we'll need to handle multiple chunks of output. `IntermediateRepresentation` better captures this intermediate, transformable nature.

Fields:
- `text: str` — the rendered output
- `source_map: list[SourceSpan]` — bidirectional mapping between text positions and source structure (includes both static and interpolated elements)
- `source_prompt: StructuredPrompt` — reference to the original structured prompt

Methods:
- `get_span_at(position: int)` — find which element produced the character at this position
- `get_span_for_key(key: Union[str, int], path: tuple[Union[str, int], ...])` — find the text span for a specific element
- `get_static_span(static_index: int, path: ...)` — find the span for a static text segment
- `get_interpolation_span(key: str, path: ...)` — find the span for an interpolation

**SourceSpan**

Immutable record of one interpolation's position in rendered text:

- `start: int` — starting position in rendered text
- `end: int` — ending position (exclusive) in rendered text
- `key: str` — the interpolation key
- `path: tuple[str, ...]` — path through nested prompts (e.g., `("outer", "inner")`)

**KeyPolicy (internal)**

Encodes rules for deriving keys from `Interpolation`s (default: use `format_spec` as key if provided else `expression`).

**Exceptions**

- `UnsupportedValueTypeError` (value is neither `str` nor `StructuredPrompt`)
- `DuplicateKeyError` (two interpolations derive the same key and duplicates are not allowed)
- `MissingKeyError` (dict-like access fails)
- `NotANestedPromptError` (attempt to index into a non-nested interpolation)

### 3.2 Rendering semantics

`StructuredPrompt.render()` returns an `IntermediateRepresentation` object containing the rendered text and a source map:

1. Walk the original `Template.strings` & `Template.interpolations`.
2. For each interpolation:
   - If `value` is `StructuredPrompt`, render that child recursively.
   - Else treat `value` as `str`.
   - If a `conversion` exists, apply it via `string.templatelib.convert(value, conversion)` to emulate f-string `!s`/`!r`/`!a`. *Python documentation*
   - Do **not** apply `format_spec` for formatting (used exclusively for key/hints).
   - Track the position and span of this interpolation in the output for source mapping.
3. Build a `SourceSpan` for each element (static and interpolation) with its position in the rendered text and its path through nested prompts.
4. Return an `IntermediateRepresentation` with the text, source map, and reference to the original prompt.

`__str__()` delegates to `render().text` for backward compatibility.

**Rationale:** t-strings explicitly defer how conversions & format specs are applied. We use format specs for the key:hints mini-language, not for formatting. The source map enables bidirectional tracing between rendered text and source structure, crucial for debugging and tooling.

*Python documentation*

### 3.3 Key uniqueness

- **Default:** keys must be unique in a given `StructuredPrompt`. If not, `DuplicateKeyError` suggests either labeling collisions differently or using `allow_duplicate_keys=True`.
- If `allow_duplicate_keys=True`, `__getitem__` raises on ambiguity, and `get_all(key)` returns a list of `StructuredInterpolation`.

## 4) Public API (proposed)

```python
# t_prompts/__init__.py
from .core import (
    IntermediateRepresentation,
    SourceSpan,
    StructuredInterpolation,
    StructuredPrompt,
    prompt,
)
from .exceptions import (
    DuplicateKeyError,
    EmptyExpressionError,
    MissingKeyError,
    NotANestedPromptError,
    StructuredPromptsError,
    UnsupportedValueTypeError,
)

__all__ = [
    "IntermediateRepresentation",
    "SourceSpan",
    "StructuredInterpolation",
    "StructuredPrompt",
    "prompt",
    "DuplicateKeyError",
    "EmptyExpressionError",
    "MissingKeyError",
    "NotANestedPromptError",
    "StructuredPromptsError",
    "UnsupportedValueTypeError",
]
```

```python
# t_prompts/core.py (high-level sketch)
from dataclasses import dataclass
from typing import Iterable, Mapping, Optional, Union
from string.templatelib import Template, Interpolation as TInterpolation, convert  # 3.14+

@dataclass(frozen=True, slots=True)
class SourceSpan:
    start: int
    end: int
    key: str
    path: tuple[str, ...]


class IntermediateRepresentation:
    """Intermediate representation with text and source mapping.

    Ideal for structured prompt optimization and multi-modal transformations.
    """
    def __init__(
        self,
        text: str,
        source_map: list[SourceSpan],
        source_prompt: "StructuredPrompt",
    ):
        self._text = text
        self._source_map = source_map
        self._source_prompt = source_prompt

    @property
    def text(self) -> str:
        return self._text

    @property
    def source_map(self) -> list[SourceSpan]:
        return self._source_map

    @property
    def source_prompt(self) -> "StructuredPrompt":
        return self._source_prompt

    def get_span_at(self, position: int) -> Optional[SourceSpan]:
        # Find the span containing this position
        ...

    def get_span_for_key(
        self, key: Union[str, int], path: tuple[Union[str, int], ...] = ()
    ) -> Optional[SourceSpan]:
        # Find the span for a specific key/path
        ...

    def get_static_span(
        self, static_index: int, path: tuple[Union[str, int], ...] = ()
    ) -> Optional[SourceSpan]:
        # Find the span for a static text segment
        ...

    def get_interpolation_span(
        self, key: str, path: tuple[Union[str, int], ...] = ()
    ) -> Optional[SourceSpan]:
        # Find the span for an interpolation
        ...


@dataclass(frozen=True, slots=True)
class StructuredInterpolation:
    key: str
    expression: str
    conversion: Optional[str]
    format_spec: str
    render_hints: str  # Extracted from format spec
    value: Union[str, "StructuredPrompt"]
    parent: Optional["StructuredPrompt"]
    index: int

    def __getitem__(self, key: str) -> "StructuredInterpolation":
        # Delegate to nested prompt if present
        vp = self.value
        if isinstance(vp, StructuredPrompt):
            return vp[key]
        raise NotANestedPromptError(self.key)

    def render(self, _path: tuple[str, ...] = ()) -> Union[str, IntermediateRepresentation]:
        # Render this node only
        # If value is StructuredPrompt, returns IntermediateRepresentation
        # Otherwise returns str
        ...


class StructuredPrompt(Mapping[str, StructuredInterpolation]):
    def __init__(self, template: Template, *, allow_duplicate_keys: bool = False):
        self._template = template
        self._interps: list[StructuredInterpolation] = []
        self._index: dict[str, int] = {}           # or dict[str, list[int]] if duplicates allowed
        # Build nodes from template.interpolations
        # 1) derive keys (format_spec or expression)
        # 2) validate value types (str or StructuredPrompt)
        # 3) enforce key policy

    # Mapping protocol
    def __getitem__(self, key: str) -> StructuredInterpolation: ...
    def __iter__(self) -> Iterable[str]: ...
    def __len__(self) -> int: ...

    # Original t-string pieces for provenance
    @property
    def template(self) -> Template: return self._template
    @property
    def strings(self) -> tuple[str, ...]: return self._template.strings
    @property
    def interpolations(self) -> tuple[StructuredInterpolation, ...]: return tuple(self._interps)

    # Rendering
    def render(self, _path: tuple[str, ...] = ()) -> IntermediateRepresentation:
        # Walk template.strings & our nodes in order
        # Build source map tracking positions and paths for all elements
        # Format specs are parsed for keys/hints, never for formatting
        ...
    def __str__(self) -> str:
        return self.render().text

    # JSON export
    def toJSON(self) -> dict:
        # Hierarchical tree structure with explicit children arrays
        ...

def prompt(template: Template, /, **opts) -> StructuredPrompt:
    """Build a StructuredPrompt from a t-string Template."""
    if not isinstance(template, Template):
        raise TypeError("prompt(...) requires a t-string Template")
    return StructuredPrompt(template, **opts)
```

**Notes from Python 3.14 t-strings (relevant to the implementation above):**

- `Template` exposes `.strings`, `.interpolations`, and `.values` (values mirror interpolation values).
- Each `Interpolation` carries `value`, `expression` (raw text), `conversion`, and `format_spec`.
- Conversions can be applied using `string.templatelib.convert`.

These are precisely the hooks we rely on to build provenance and handle rendering.

*Python documentation*

## 5) Behavior details & edge cases

**Allowed interpolation value types**

- `str` or `StructuredPrompt`.
- Anything else → `UnsupportedValueTypeError` with a clear message showing the offending `expression` and actual `type(value)`.

**Key derivation (Format Spec Mini-Language)**

The format spec is parsed as `"key : render_hints"`:

- If `format_spec` is empty or `"_"`, `key = expression`.
- If `format_spec` contains no colon, `key = format_spec.strip()`.
- If `format_spec` contains a colon, split on first colon: `key = part_before.strip()`, `render_hints = part_after`.
- Keys are trimmed of leading/trailing whitespace but preserve internal spaces.
- Empty expression (`{}`) is not allowed; guard with a clear error.

**Duplicate keys**

- Default: raise `DuplicateKeyError`.
- Optional: `allow_duplicate_keys=True`; then `get_all("key")` → `list[StructuredInterpolation]`.

**Rendering**

- Conversions are always applied.
- Format specs are parsed for key/hints but never applied as formatting directives.
- Returns an `IntermediateRepresentation` with text and source mapping.

**Nesting**

- If an interpolation's value is a `StructuredPrompt`, we keep it nested; `__str__` recurses.
- Index chaining works via `StructuredInterpolation.__getitem__`.

**Ordering**

- `StructuredPrompt` preserves the original interpolation order for iteration and repr.

**JSON export**

`toJSON()` returns a hierarchical tree structure with explicit `children` arrays, making it ideal for analysis and external tools processing prompt structure.

## 6) Example walkthrough

Given:

```python
instructions = "Always answer politely."
foo = "bar"
p  = prompt(t"Obey {instructions:inst}")
p2 = prompt(t"bazz {foo} {p}")
```

**p has:**

- `strings = ("Obey ", "")`
- One interpolation → `StructuredInterpolation`:
  - `key = "inst"` (from `format_spec`)
  - `expression = "instructions"`
  - `value = "Always answer politely."` (type `str`)

**p2 has:**

- `strings = ("bazz ", " ", "")`
- Interpolations:
  - `key = "foo"` → value `"bar"`
  - `key = "p"` → value is the `StructuredPrompt` `p`

`p2['p']['inst']` returns the child node for `"inst"` with full provenance (`expression` `"instructions"`, etc.).

(The shape & fields of `Template` and `Interpolation` used above come from the CPython 3.14 docs.)

*Python documentation*

## 7) Implementation plan

### Phase 0 — Scaffolding

- Package skeleton: `t_prompts/` (`core.py`, `exceptions.py`, `ui.py`, `__init__.py`)
- `pyproject.toml` with `requires-python = ">=3.14"`
- Strict tooling: ruff, mypy, pytest, coverage, pre-commit
- CI: GitHub Actions on 3.14 (and 3.15-dev later)

### Phase 1 — Data model

- Implement `StructuredInterpolation` (immutable dataclass, `slots=True`)
- Implement `StructuredPrompt` with `Mapping` interface; store `Template` and derived nodes
- Implement `prompt()` thin wrapper

### Phase 2 — Key policy & parsing

- Convert `Template.interpolations` to `StructuredInterpolation`s
- Enforce key uniqueness (configurable)
- Validate interpolation values (must be `str` or `StructuredPrompt`)

### Phase 3 — Rendering

- Implement `render()` and `__str__`
- Apply conversions using `string.templatelib.convert` (doc-backed) *Python documentation*
- Format specs are never applied for formatting (used only as keys)

### Phase 4 — Navigation & utilities

- `__getitem__`, `get_all`, iteration order
- `toJSON()` for hierarchical tree export (JSON-safe)
- Friendly `__repr__` for debugging

### Phase 5 — Errors & docs

- Implement custom exceptions with helpful context (include `expression` and `key`)
- API docs / README with examples & rationale

### Phase 6 — Tests (heavy emphasis; no mocks)

**Philosophy:** This library wraps pure data (3.14 `Template` & `Interpolation`). There's no I/O; use real objects, not mocks.

**Coverage goals:** ≥95% statements/branches.

**Test matrix:**

#### Happy paths

- Single interpolation with key: `{instructions:inst}`
- No format spec (key from expression): `{foo}`
- Conversions `!s`/`!r`/`!a` applied via `convert`
- Nesting depth 2–3; rendering and navigation

#### Edge cases

- Duplicate keys → error / `allow_duplicate_keys`
- Expression with whitespace → key equality & retrieval
- Empty strings among `Template.strings` (doc shows they can occur) *Python documentation*
- Interpolation adjacent to another (tests alignment of strings vs nodes) *Python documentation*
- Format spec used as key that looks like a mini-language → ensure default `render()` does not treat it as formatting

#### Unsupported values

- `{42}` → `UnsupportedValueTypeError`

#### Round-trips

`str(prompt(t"..."))` equals expected f-string rendering when no format spec is provided (format specs are used only as keys, never for formatting).

#### JSON export

- `toJSON()` produces hierarchical tree structure with explicit children arrays, including all metadata like `expression`, `conversion`, `format_spec`, source locations, and IDs

#### Property tests (optional stretch)

Generate random strings and simple interpolations to ensure strings and interpolations alignment is preserved.

We rely on real `Template`/`Interpolation` structures produced by t-strings. The CPython docs specify the exact attributes we introspect; no mocks are needed to get stable, meaningful tests.

*Python documentation*

## 8) Extensibility & future work

- **Source locations:** Augment `StructuredInterpolation` with `code_location` (filename, line/col, function) when 3.14+ APIs expose this (or via inspect/tracebacks during construction).
- **Key policy plug-in:** alternative key extraction strategies (e.g., use `=name` debugging syntax if/when surfaced by t-strings).
- **Validation modes:** strict identifier keys vs free-form.
- **Render hooks:** Interpret render hints to apply custom formatting (e.g., `{data:key:format=json,indent=2}` could trigger JSON formatting).
- **Stable JSON schema:** define a versioned schema for provenance exchange across services.
- **Enhanced source mapping:** Add support for querying all spans matching a pattern, or finding overlapping spans.

## 9) Risks & mitigations

**Spec evolution:** t-strings are new; small behavioral changes may land in 3.14.x.

**Mitigation:** keep coupling minimal; use only documented attributes (`strings`, `interpolations`, `values`, and `convert`). Track CPython "What's New" notes.

*Python documentation*

**Format spec ambiguity:** We intentionally repurpose `format_spec` as a key label only.

**Mitigation:** rendering always ignores format specs for formatting purposes.

## 10) References

- `string.templatelib` docs (types, fields, and `convert`) — Python 3.14 stdlib. *Python documentation*
- What's New in Python 3.14 (overview of template strings / t-strings). *Python documentation*
- PEP 750 — Template Strings (motivating design, formalization). *Python Enhancement Proposals (PEPs)*

## 11) Appendix — Minimal internal algorithms

### Format Spec Parser

```python
def _parse_format_spec(format_spec: str, expression: str) -> tuple[str, str]:
    """Parse format spec mini-language: 'key : render_hints'.

    Returns: (key, render_hints)
    """
    if not format_spec or format_spec == "_":
        return expression, ""

    if ":" in format_spec:
        key_part, hints_part = format_spec.split(":", 1)
        return key_part.strip(), hints_part
    else:
        return format_spec.strip(), ""
```

### Building the tree

```python
def _build_nodes(self, template: Template, allow_dupes: bool) -> None:
    for idx, itp in enumerate(template.interpolations):
        # Parse format spec for key and render hints
        key, render_hints = _parse_format_spec(itp.format_spec, itp.expression)

        val = itp.value
        if isinstance(val, StructuredPrompt):
            node_val = val
        elif isinstance(val, str):
            node_val = val
        else:
            raise UnsupportedValueTypeError(key, type(val), itp.expression)

        node = StructuredInterpolation(
            key=key,
            expression=itp.expression,
            conversion=itp.conversion,
            format_spec=itp.format_spec,
            render_hints=render_hints,
            value=node_val,
            parent=self,
            index=idx,
        )
        self._interps.append(node)

        if allow_dupes:
            self._index.setdefault(key, []).append(idx)
        else:
            if key in self._index:
                raise DuplicateKeyError(key)
            self._index[key] = idx
```

### Rendering

```python
def render(self, _path: tuple[str, ...] = ()) -> IntermediateRepresentation:
    """Render to text with source mapping for all elements (static and interpolations)."""
    out_parts: list[str] = []
    source_map: list[SourceSpan] = []
    current_pos = 0

    # Iterate through all elements (Static and StructuredInterpolation)
    for element in self._elements:
        span_start = current_pos

        if isinstance(element, Static):
            # Render static element
            rendered_text = element.value
            out_parts.append(rendered_text)
            current_pos += len(rendered_text)

            # Create span for static (only if non-empty)
            if rendered_text:
                source_map.append(SourceSpan(
                    start=span_start,
                    end=current_pos,
                    key=element.key,
                    path=_path,
                    element_type="static"
                ))

        elif isinstance(element, StructuredInterpolation):
            node = element
            current_path = _path + (node.key,)

            # Render the interpolation value
            if isinstance(node.value, StructuredPrompt):
                rendered = node.value.render(_path=current_path)
                out = rendered.text
                # Add nested spans with offset
                for span in rendered.source_map:
                    source_map.append(
                        SourceSpan(
                            start=span.start + span_start,
                            end=span.end + span_start,
                            key=span.key,
                            path=span.path,
                            element_type=span.element_type
                        )
                    )
            else:
                out = node.value

            # Apply conversion if present
            if node.conversion:
                conv: Literal["r", "s", "a"] = node.conversion  # type: ignore
                out = convert(out, conv)

            # Add span for this interpolation
            current_pos += len(out)
            if not isinstance(node.value, StructuredPrompt):
                source_map.append(
                    SourceSpan(
                        start=span_start,
                        end=current_pos,
                        key=node.key,
                        path=current_path,
                        element_type="interpolation"
                    )
                )

            out_parts.append(out)

    text = "".join(out_parts)
    return IntermediateRepresentation(text, source_map, self)
```

## 12) Dedenting Support

### Motivation

When writing multi-line prompts in source code, proper indentation with surrounding code is crucial for readability. However, this indentation should not appear in the final rendered prompt. The dedenting feature solves this problem by automatically removing common indentation from t-strings.

### Design Philosophy

Dedenting is **opt-in by default** via `dedent=True`, while **trimming is on by default**. This allows users to write indented t-strings in their source code without the indentation appearing in the rendered output, while still benefiting from automatic removal of leading/trailing whitespace lines.

The processing happens **at construction time** in `_build_nodes()`, modifying the static text segments before creating `Static` elements. This means:

1. Original template strings remain unchanged (provenance preserved)
2. Source mapping points to dedented text (the actual rendered output)
3. Dedenting is applied once and stored, not recalculated on each render

### Processing Steps

The `_process_dedent()` function applies four optional transformations to template strings:

1. **Trim leading** (`trim_leading=True` by default)
   - Removes the first line of the first static if it ends in newline and contains only whitespace
   - Handles the common pattern: `t"""\n    content...`
   - The leading newline + spaces are removed

2. **Trim empty leading** (`trim_empty_leading=True` by default)
   - After removing the first line, removes any subsequent lines that are just `\n`
   - Allows for blank lines for readability after the opening `"""`

3. **Dedent** (`dedent=False` by default, opt-in)
   - Finds the first non-empty line across all statics
   - Counts its leading spaces to determine indent level
   - Removes that many spaces from every line in all statics
   - Errors if tabs and spaces are mixed in indentation

4. **Trim trailing** (`trim_trailing=True` by default)
   - Removes trailing whitespace lines (lines that are just whitespace)
   - Applied to the last static segment
   - Cleans up the closing `"""` pattern

### API Design

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
    """Build a StructuredPrompt with optional dedenting."""
    ...
```

All dedenting parameters are **keyword-only** to prevent accidental positional arguments.

### Implementation Details

The `_process_dedent()` function:

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
    # Returns a new tuple with processed strings
    # Original strings remain in template for provenance
```

Processed strings are passed to `StructuredPrompt.__init__()` via a private `_processed_strings` parameter. The `_build_nodes()` method uses these processed strings instead of the original `template.strings`.

### Source Mapping Implications

Source mapping points to the **dedented text**, not the original indented source code. This is intentional and correct because:

1. Users want to map positions in the **rendered** output back to structure
2. Consistent with how conversions work (!r changes the text)
3. The dedented version is what appears in `IntermediateRepresentation.text`
4. Original strings remain available via `prompt.template.strings` for debugging

### Edge Cases Handled

1. **Empty first static**: When first static is empty (e.g., `t"{x:x} text"`), dedenting works on subsequent statics
2. **Nested prompts**: Each prompt is dedented independently at construction time
3. **Mixed indentation levels**: Dedents by the first non-empty line's indent level
4. **Less indented lines**: Dedents as much as possible without negative indentation
5. **No non-empty lines**: Dedenting does nothing (no error)
6. **Tabs and spaces mixed**: Raises `DedentError` to prevent ambiguity

### Rationale for Default Behavior

- **Trims ON by default**: Most users want clean output without leading/trailing whitespace lines
- **Dedent OFF by default**: Dedenting changes content more significantly, so it's opt-in
- **All keyword-only**: Prevents accidental misuse and makes intent explicit

### Example Transformation

```python
# Input with dedent=True:
p = prompt(t"""
    You are a helpful assistant.
    Task: {task:t}
    Please respond.
    """, dedent=True)

# Processing steps:
# 1. Trim leading: Remove "\n"
# 2. Trim empty leading: (none in this case)
# 3. Dedent: First non-empty line has 4 spaces, remove 4 from all
# 4. Trim trailing: Remove "\n    "

# Result:
# "You are a helpful assistant.\nTask: ...\nPlease respond."
```

### Testing Strategy

Comprehensive test suite (46 tests in `test_dedent.py`) covering:

- Basic dedenting with various indentation patterns
- Each trim feature independently
- All features combined
- Edge cases (empty statics, nested prompts, mixed indentation)
- Error conditions (tabs/spaces mixed)
- Source mapping with dedented text
- Provenance preservation
- List interpolations with dedenting
- Realistic LLM prompt patterns

## Summary

This library leverages Python 3.14's t-strings to give you string rendering + structured provenance for LLM prompts. It stays close to the standard library's `Template`/`Interpolation` model (no monkey-patching), keeps the API small, and emphasizes strong, no-mock tests that exercise real runtime behavior.

*Python documentation*
