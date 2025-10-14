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

Render hints are stored but not currently applied during rendering—they're available for custom renderers or tooling.

*Python documentation*

## 3) Core concepts & data model

### 3.1 Types

**StructuredPrompt**

- Wraps a `string.templatelib.Template` (the original t-string structure). *Python documentation*
- Dict-like access to `StructuredInterpolation` nodes.
- Preserves ordering of interpolations.
- Renders to `RenderedPrompt` with source mapping, applying conversion semantics.

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

**RenderedPrompt**

Result of rendering a `StructuredPrompt`, providing both text and source mapping:

- `text: str` — the rendered output
- `source_map: list[SourceSpan]` — bidirectional mapping between text positions and source structure
- `source_prompt: StructuredPrompt` — reference to the original structured prompt

Methods:
- `get_span_at(position: int)` — find which interpolation produced the character at this position
- `get_span_for_key(key: str, path: tuple[str, ...])` — find the text span for a specific interpolation

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

`StructuredPrompt.render()` returns a `RenderedPrompt` object containing the rendered text and a source map:

1. Walk the original `Template.strings` & `Template.interpolations`.
2. For each interpolation:
   - If `value` is `StructuredPrompt`, render that child recursively.
   - Else treat `value` as `str`.
   - If a `conversion` exists, apply it via `string.templatelib.convert(value, conversion)` to emulate f-string `!s`/`!r`/`!a`. *Python documentation*
   - Do **not** apply `format_spec` for formatting (used exclusively for key/hints).
   - Track the position and span of this interpolation in the output for source mapping.
3. Build a `SourceSpan` for each interpolation with its position in the rendered text and its path through nested prompts.
4. Return a `RenderedPrompt` with the text, source map, and reference to the original prompt.

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
    RenderedPrompt,
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
    "RenderedPrompt",
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


class RenderedPrompt:
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

    def get_span_at(self, position: int) -> SourceSpan:
        # Find the span containing this position
        ...

    def get_span_for_key(
        self, key: str, path: tuple[str, ...] = ()
    ) -> SourceSpan:
        # Find the span for a specific key/path
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

    def render(self, _path: tuple[str, ...] = ()) -> Union[str, RenderedPrompt]:
        # Render this node only
        # If value is StructuredPrompt, returns RenderedPrompt
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
    def render(self, _path: tuple[str, ...] = ()) -> RenderedPrompt:
        # Walk template.strings & our nodes in order
        # Build source map tracking positions and paths
        # Format specs are parsed for keys/hints, never for formatting
        ...
    def __str__(self) -> str:
        return self.render().text

    # Convenience
    def to_values(self) -> dict[str, Union[str, dict]]:
        # JSON-serializable values tree (render nested prompts)
        ...
    def to_provenance(self) -> dict:
        # JSON-serializable provenance tree including expression, conversion, format_spec, etc.
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
- Returns a `RenderedPrompt` with text and source mapping.

**Nesting**

- If an interpolation's value is a `StructuredPrompt`, we keep it nested; `__str__` recurses.
- Index chaining works via `StructuredInterpolation.__getitem__`.

**Ordering**

- `StructuredPrompt` preserves the original interpolation order for iteration and repr.

**Provenance export**

`to_provenance()` returns a nested dict like:

```json
{
  "strings": ["prefix ", " ", ""],
  "nodes": [
    {"key":"foo","expression":"foo","conversion":null,"format_spec":""},
    {"key":"p","expression":"p","conversion":null,"format_spec":""}
  ]
}
```

`to_values()` returns only rendered values (strings), resolving child prompts.

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

- Package skeleton: `t_prompts/` (`core.py`, `exceptions.py`, `utils.py`, `__init__.py`)
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
- `to_values()` and `to_provenance()` (JSON-safe)
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

#### Provenance

- `to_provenance()` includes `expression`, `conversion`, `format_spec`, positions, and matches the source
- `to_values()` produces nested dict of plain strings

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
def render(self, _path: tuple[str, ...] = ()) -> RenderedPrompt:
    """Render to text with source mapping."""
    out_parts: list[str] = []
    source_map: list[SourceSpan] = []
    current_pos = 0

    strings = list(self._template.strings)
    out_parts.append(strings[0])
    current_pos += len(strings[0])

    for idx, node in enumerate(self._interps):
        start_pos = current_pos
        current_path = _path + (node.key,)

        # Render the interpolation value
        if isinstance(node.value, StructuredPrompt):
            rendered = node.value.render(_path=current_path)
            out = rendered.text
            # Add nested spans with offset
            for span in rendered.source_map:
                source_map.append(
                    SourceSpan(
                        start=span.start + start_pos,
                        end=span.end + start_pos,
                        key=span.key,
                        path=span.path,
                    )
                )
        else:
            out = node.value

        # Apply conversion if present
        if node.conversion:
            conv: Literal["r", "s", "a"] = node.conversion  # type: ignore
            out = convert(out, conv)

        # Add span for this interpolation
        end_pos = start_pos + len(out)
        source_map.append(
            SourceSpan(start=start_pos, end=end_pos, key=node.key, path=current_path)
        )

        out_parts.append(out)
        current_pos = end_pos

        # Add the next string segment
        next_str = strings[idx + 1]
        out_parts.append(next_str)
        current_pos += len(next_str)

    text = "".join(out_parts)
    return RenderedPrompt(text, source_map, self)
```

## Summary

This library leverages Python 3.14's t-strings to give you string rendering + structured provenance for LLM prompts. It stays close to the standard library's `Template`/`Interpolation` model (no monkey-patching), keeps the API small, and emphasizes strong, no-mock tests that exercise real runtime behavior.

*Python documentation*
