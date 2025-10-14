"""Core implementation of structured prompts."""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from string.templatelib import Template, convert
from typing import Any, Literal, Optional, Union

from .exceptions import (
    DuplicateKeyError,
    EmptyExpressionError,
    MissingKeyError,
    NotANestedPromptError,
    UnsupportedValueTypeError,
)


def _parse_format_spec(format_spec: str, expression: str) -> tuple[str, str]:
    """
    Parse format spec mini-language: "key : render_hints".

    Rules:
    - If format_spec is empty, key = expression
    - If format_spec is "_", key = expression
    - If format_spec contains ":", split on first colon:
      - First part is key (trimmed if there's a colon, preserving whitespace in key name)
      - Second part (if present) is render_hints
    - Otherwise, format_spec is the key as-is (preserving any whitespace)

    Parameters
    ----------
    format_spec : str
        The format specification from the t-string
    expression : str
        The expression text (fallback for key derivation)

    Returns
    -------
    tuple[str, str]
        (key, render_hints) where render_hints may be empty string
    """
    if not format_spec or format_spec == "_":
        # Use expression as key, no render hints
        return expression, ""

    # Split on first colon to separate key from render hints
    if ":" in format_spec:
        key_part, hints_part = format_spec.split(":", 1)
        # Trim key when there's a colon delimiter
        return key_part.strip(), hints_part
    else:
        # No colon, entire format_spec is the key (trim leading/trailing, preserve internal whitespace)
        return format_spec.strip(), ""


@dataclass(frozen=True, slots=True)
class SourceSpan:
    """
    Represents a span in the rendered output that maps back to a source element.

    Attributes
    ----------
    start : int
        Starting position (inclusive) in the rendered string.
    end : int
        Ending position (exclusive) in the rendered string.
    key : Union[str, int]
        The key of the element: string for interpolations, int for static segments.
    path : tuple[Union[str, int], ...]
        Path from root to this element (sequence of keys).
    element_type : Literal["static", "interpolation"]
        The type of element this span represents.
    """
    start: int
    end: int
    key: Union[str, int]
    path: tuple[Union[str, int], ...]
    element_type: Literal["static", "interpolation"]


class IntermediateRepresentation:
    """
    Intermediate representation of a StructuredPrompt with text and source mapping.

    This class serves as the bridge between structured prompts and their final output.
    It's ideal for:
    - Structured prompt optimization (removing parts when approaching context limits)
    - Debugging optimization strategies with full provenance
    - Future multi-modal support (multiple chunks for images, etc.)

    The name "IntermediateRepresentation" reflects that this is not necessarily the
    final output sent to an LLM, but rather a structured intermediate form that can
    be further processed, optimized, or transformed before final rendering.

    Attributes
    ----------
    text : str
        The rendered string output.
    source_map : list[SourceSpan]
        List of source spans mapping rendered text back to all elements (static and interpolations).
    source_prompt : StructuredPrompt
        The StructuredPrompt that was rendered to produce this result.
    """

    def __init__(self, text: str, source_map: list[SourceSpan], source_prompt: "StructuredPrompt"):
        self._text = text
        self._source_map = source_map
        self._source_prompt = source_prompt

    @property
    def text(self) -> str:
        """Return the rendered text."""
        return self._text

    @property
    def source_map(self) -> list[SourceSpan]:
        """Return the source map."""
        return self._source_map

    @property
    def source_prompt(self) -> "StructuredPrompt":
        """Return the source StructuredPrompt that was rendered."""
        return self._source_prompt

    def get_span_at(self, position: int) -> Optional[SourceSpan]:
        """
        Get the source span at a given position in the rendered text.

        Parameters
        ----------
        position : int
            Position in the rendered text.

        Returns
        -------
        SourceSpan | None
            The span containing this position, or None if not in any span.
        """
        for span in self._source_map:
            if span.start <= position < span.end:
                return span
        return None

    def get_span_for_key(self, key: Union[str, int], path: tuple[Union[str, int], ...] = ()) -> Optional[SourceSpan]:
        """
        Get the source span for a specific key and path.

        Parameters
        ----------
        key : Union[str, int]
            The key to search for (string for interpolations, int for statics).
        path : tuple[Union[str, int], ...]
            The path from root to the element (empty for root level).

        Returns
        -------
        SourceSpan | None
            The span for this key/path, or None if not found.
        """
        for span in self._source_map:
            if span.key == key and span.path == path:
                return span
        return None

    def get_static_span(self, static_index: int, path: tuple[Union[str, int], ...] = ()) -> Optional[SourceSpan]:
        """
        Get the source span for a static segment by its index.

        Parameters
        ----------
        static_index : int
            The index of the static segment (position in template strings tuple).
        path : tuple[Union[str, int], ...]
            The path from root to the static (empty for root level).

        Returns
        -------
        SourceSpan | None
            The span for this static, or None if not found.
        """
        for span in self._source_map:
            if span.element_type == "static" and span.key == static_index and span.path == path:
                return span
        return None

    def get_interpolation_span(self, key: str, path: tuple[Union[str, int], ...] = ()) -> Optional[SourceSpan]:
        """
        Get the source span for an interpolation by its key.

        Parameters
        ----------
        key : str
            The key of the interpolation.
        path : tuple[Union[str, int], ...]
            The path from root to the interpolation (empty for root level).

        Returns
        -------
        SourceSpan | None
            The span for this interpolation, or None if not found.
        """
        for span in self._source_map:
            if span.element_type == "interpolation" and span.key == key and span.path == path:
                return span
        return None

    def __str__(self) -> str:
        """Return the rendered text."""
        return self._text

    def __repr__(self) -> str:
        """Return a helpful debug representation."""
        return f"IntermediateRepresentation(text={self._text!r}, spans={len(self._source_map)})"


@dataclass(frozen=True, slots=True)
class Element:
    """
    Base class for all elements in a StructuredPrompt.

    An element can be either a Static text segment or a StructuredInterpolation.

    Attributes
    ----------
    key : Union[str, int]
        Identifier for this element. For interpolations: string key from format_spec.
        For static segments: integer index in the strings tuple.
    parent : StructuredPrompt | None
        The parent StructuredPrompt that contains this element.
    index : int
        The position of this element in the overall element sequence.
    """

    key: Union[str, int]
    parent: Optional["StructuredPrompt"]
    index: int


@dataclass(frozen=True, slots=True)
class Static(Element):
    """
    Represents a static string segment from the t-string.

    Static segments are the literal text between interpolations.

    Attributes
    ----------
    key : int
        The position of this static in the template's strings tuple.
    value : str
        The static text content.
    parent : StructuredPrompt | None
        The parent StructuredPrompt that contains this static.
    index : int
        The position of this element in the overall element sequence.
    """

    key: int
    value: str
    parent: Optional["StructuredPrompt"]
    index: int


@dataclass(frozen=True, slots=True)
class StructuredInterpolation(Element):
    """
    Immutable record of one interpolation occurrence in a StructuredPrompt.

    Attributes
    ----------
    key : str
        The key used for dict-like access (parsed from format_spec or expression).
    expression : str
        The original expression text from the t-string (what was inside {}).
    conversion : str | None
        The conversion flag if present (!s, !r, !a), or None.
    format_spec : str
        The format specification string (everything after :), or empty string.
    render_hints : str
        Rendering hints parsed from format_spec (everything after first colon in format spec).
    value : str | StructuredPrompt | list[StructuredPrompt]
        The evaluated value (string, nested StructuredPrompt, or list of StructuredPrompts).
    parent : StructuredPrompt | None
        The parent StructuredPrompt that contains this interpolation.
    index : int
        The position of this element in the overall element sequence.
    """

    key: str
    expression: str
    conversion: Optional[str]
    format_spec: str
    render_hints: str
    value: Union[str, "StructuredPrompt", list["StructuredPrompt"]]
    parent: Optional["StructuredPrompt"]
    index: int

    def __getitem__(self, key: str) -> "StructuredInterpolation":
        """
        Delegate dict-like access to nested StructuredPrompt if present.

        Parameters
        ----------
        key : str
            The key to look up in the nested prompt.

        Returns
        -------
        StructuredInterpolation
            The interpolation node from the nested prompt.

        Raises
        ------
        NotANestedPromptError
            If the value is not a StructuredPrompt.
        """
        if isinstance(self.value, StructuredPrompt):
            return self.value[key]
        raise NotANestedPromptError(self.key)

    def render(self) -> Union[str, "IntermediateRepresentation"]:
        """
        Render this interpolation node.

        If the value is a StructuredPrompt, returns an IntermediateRepresentation.
        If the value is a string, returns a string with conversions applied.

        Returns
        -------
        str | IntermediateRepresentation
            The rendered value of this interpolation.
        """
        if isinstance(self.value, StructuredPrompt):
            return self.value.render()
        else:
            out = self.value
            if self.conversion:
                # Type narrowing for convert - only valid conversion types
                conv: Literal["r", "s", "a"] = self.conversion  # type: ignore
                return convert(out, conv)
            return out

    def __repr__(self) -> str:
        """Return a helpful debug representation."""
        value_repr = "StructuredPrompt(...)" if isinstance(self.value, StructuredPrompt) else repr(self.value)
        return (
            f"StructuredInterpolation(key={self.key!r}, expression={self.expression!r}, "
            f"conversion={self.conversion!r}, format_spec={self.format_spec!r}, "
            f"render_hints={self.render_hints!r}, value={value_repr}, index={self.index})"
        )


class StructuredPrompt(Mapping[str, StructuredInterpolation]):
    """
    A provenance-preserving, navigable tree representation of a t-string.

    StructuredPrompt wraps a string.templatelib.Template (from a t-string)
    and provides dict-like access to its interpolations, preserving full
    provenance information (expression, conversion, format_spec, value).

    Parameters
    ----------
    template : Template
        The Template object from a t-string literal.
    allow_duplicate_keys : bool, optional
        If True, allows duplicate keys and provides get_all() for access.
        If False (default), raises DuplicateKeyError on duplicate keys.

    Raises
    ------
    UnsupportedValueTypeError
        If any interpolation value is not str, StructuredPrompt, or list[StructuredPrompt].
    DuplicateKeyError
        If duplicate keys are found and allow_duplicate_keys=False.
    EmptyExpressionError
        If an empty expression {} is encountered.
    """

    def __init__(self, template: Template, *, allow_duplicate_keys: bool = False):
        self._template = template
        self._elements: list[Element] = []  # All elements (Static and StructuredInterpolation)
        self._interps: list[StructuredInterpolation] = []  # Backward compat: only interpolations
        self._allow_duplicates = allow_duplicate_keys

        # Index maps keys to interpolation indices (within _interps list)
        # If allow_duplicates, maps to list of indices; otherwise, maps to single index
        self._index: dict[str, Union[int, list[int]]] = {}

        self._build_nodes()

    def _build_nodes(self) -> None:
        """Build Element nodes (Static and StructuredInterpolation) from the template."""
        strings = self._template.strings
        interpolations = self._template.interpolations

        element_idx = 0  # Overall position in element sequence
        interp_idx = 0   # Position within interpolations list

        # Interleave statics and interpolations
        for static_key, static_text in enumerate(strings):
            # Add static element
            static = Static(
                key=static_key,
                value=static_text,
                parent=self,
                index=element_idx,
            )
            self._elements.append(static)
            element_idx += 1

            # Add interpolation if there's one after this static
            if static_key < len(interpolations):
                itp = interpolations[static_key]

                # Parse format spec to extract key and render hints
                key, render_hints = _parse_format_spec(itp.format_spec, itp.expression)

                # Guard against empty keys
                if not key:
                    raise EmptyExpressionError()

                # Validate and extract value
                val = itp.value
                if isinstance(val, StructuredPrompt):
                    node_val = val
                elif isinstance(val, str):
                    node_val = val
                elif isinstance(val, list):
                    # Check that all items in the list are StructuredPrompts
                    if not all(isinstance(item, StructuredPrompt) for item in val):
                        raise UnsupportedValueTypeError(key, type(val), itp.expression)
                    node_val = val
                else:
                    raise UnsupportedValueTypeError(key, type(val), itp.expression)

                # Create the interpolation node
                node = StructuredInterpolation(
                    key=key,
                    expression=itp.expression,
                    conversion=itp.conversion,
                    format_spec=itp.format_spec,
                    render_hints=render_hints,
                    value=node_val,
                    parent=self,
                    index=element_idx,
                )
                self._interps.append(node)
                self._elements.append(node)
                element_idx += 1

                # Update index (maps string keys to positions in _interps list)
                if self._allow_duplicates:
                    if key not in self._index:
                        self._index[key] = []
                    self._index[key].append(interp_idx)  # type: ignore
                else:
                    if key in self._index:
                        raise DuplicateKeyError(key)
                    self._index[key] = interp_idx

                interp_idx += 1

    # Mapping protocol implementation

    def __getitem__(self, key: str) -> StructuredInterpolation:
        """
        Get the interpolation node for the given key.

        Parameters
        ----------
        key : str
            The key to look up (derived from format_spec or expression).

        Returns
        -------
        StructuredInterpolation
            The interpolation node for this key.

        Raises
        ------
        MissingKeyError
            If the key is not found.
        ValueError
            If allow_duplicate_keys=True and the key is ambiguous (use get_all instead).
        """
        if key not in self._index:
            raise MissingKeyError(key, list(self._index.keys()))

        idx = self._index[key]
        if isinstance(idx, list):
            if len(idx) > 1:
                raise ValueError(f"Ambiguous key '{key}' with {len(idx)} occurrences. Use get_all('{key}') instead.")
            idx = idx[0]

        return self._interps[idx]

    def __iter__(self) -> Iterable[str]:
        """Iterate over keys in insertion order."""
        seen = set()
        for node in self._interps:
            if node.key not in seen:
                yield node.key
                seen.add(node.key)

    def __len__(self) -> int:
        """Return the number of unique keys."""
        return len(set(node.key for node in self._interps))

    def get_all(self, key: str) -> list[StructuredInterpolation]:
        """
        Get all interpolation nodes for a given key (for duplicate keys).

        Parameters
        ----------
        key : str
            The key to look up.

        Returns
        -------
        list[StructuredInterpolation]
            List of all interpolation nodes with this key.

        Raises
        ------
        MissingKeyError
            If the key is not found.
        """
        if key not in self._index:
            raise MissingKeyError(key, list(self._index.keys()))

        idx = self._index[key]
        if isinstance(idx, list):
            return [self._interps[i] for i in idx]
        else:
            return [self._interps[idx]]

    # Properties for provenance

    @property
    def template(self) -> Template:
        """Return the original Template object."""
        return self._template

    @property
    def strings(self) -> tuple[str, ...]:
        """Return the static string segments from the template."""
        return self._template.strings

    @property
    def interpolations(self) -> tuple[StructuredInterpolation, ...]:
        """Return all interpolation nodes in order."""
        return tuple(self._interps)

    @property
    def elements(self) -> tuple[Element, ...]:
        """Return all elements (Static and StructuredInterpolation) in order."""
        return tuple(self._elements)

    # Rendering

    def render(self, _path: tuple[Union[str, int], ...] = ()) -> IntermediateRepresentation:
        """
        Render this StructuredPrompt to an IntermediateRepresentation with source mapping.

        Creates source spans for both static text segments and interpolations.
        Conversions (!s, !r, !a) are always applied.
        Format specs are parsed as "key : render_hints".

        The IntermediateRepresentation is ideal for:
        - Structured optimization when approaching context limits
        - Debugging and auditing with full provenance
        - Future multi-modal transformations

        Parameters
        ----------
        _path : tuple[Union[str, int], ...]
            Internal parameter for tracking path during recursive rendering.

        Returns
        -------
        IntermediateRepresentation
            Object containing the rendered text and source map.
        """
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
                # Render interpolation element
                node = element

                # Get value (render recursively if nested or list)
                if isinstance(node.value, list):
                    # Handle list of StructuredPrompts
                    # Parse separator from render_hints (default: newline)
                    separator = "\n"
                    if node.render_hints:
                        # Look for "sep=<value>" in render hints
                        for hint in node.render_hints.split(":"):
                            if hint.startswith("sep="):
                                separator = hint[4:]  # Extract everything after "sep="
                                break

                    # Render each item and join with separator
                    rendered_parts = []
                    for item in node.value:
                        item_rendered = item.render(_path=_path + (node.key,))
                        rendered_parts.append(item_rendered.text)
                        # Add nested source spans with offset
                        current_offset = span_start + sum(len(p) + len(separator) for p in rendered_parts[:-1])
                        for nested_span in item_rendered.source_map:
                            source_map.append(SourceSpan(
                                start=current_offset + nested_span.start,
                                end=current_offset + nested_span.end,
                                key=nested_span.key,
                                path=nested_span.path,
                                element_type=nested_span.element_type
                            ))
                    rendered_text = separator.join(rendered_parts)

                elif isinstance(node.value, StructuredPrompt):
                    nested_rendered = node.value.render(_path=_path + (node.key,))
                    rendered_text = nested_rendered.text
                    # Add nested source spans with updated paths
                    for nested_span in nested_rendered.source_map:
                        source_map.append(SourceSpan(
                            start=span_start + nested_span.start,
                            end=span_start + nested_span.end,
                            key=nested_span.key,
                            path=nested_span.path,
                            element_type=nested_span.element_type
                        ))

                else:
                    rendered_text = node.value
                    # Apply conversion if present
                    if node.conversion:
                        conv: Literal["r", "s", "a"] = node.conversion  # type: ignore
                        rendered_text = convert(rendered_text, conv)

                # Add span for this interpolation
                current_pos += len(rendered_text)
                if not isinstance(node.value, (StructuredPrompt, list)):
                    # Only add direct span if not nested or list (nested spans are already added above)
                    source_map.append(SourceSpan(
                        start=span_start,
                        end=current_pos,
                        key=node.key,
                        path=_path,
                        element_type="interpolation"
                    ))

                out_parts.append(rendered_text)

        text = "".join(out_parts)
        return IntermediateRepresentation(text, source_map, self)

    def __str__(self) -> str:
        """Render to string (convenience for render().text)."""
        return self.render().text

    # Convenience methods for JSON export

    def to_values(self) -> dict[str, Any]:
        """
        Export a JSON-serializable dict of rendered values.

        Nested StructuredPrompts are recursively converted to dicts.

        Returns
        -------
        dict[str, Any]
            A dictionary mapping keys to rendered string values or nested dicts.
        """
        result = {}
        for node in self._interps:
            if isinstance(node.value, list):
                result[node.key] = [item.to_values() for item in node.value]
            elif isinstance(node.value, StructuredPrompt):
                result[node.key] = node.value.to_values()
            else:
                # Get rendered value for this node
                rendered = node.render()
                result[node.key] = rendered if isinstance(rendered, str) else rendered.text
        return result

    def to_provenance(self) -> dict[str, Any]:
        """
        Export a JSON-serializable dict with full provenance information.

        Returns
        -------
        dict[str, Any]
            A dictionary with 'strings' (the static segments) and 'nodes'
            (list of dicts with key, expression, conversion, format_spec, render_hints, and value info).
        """
        nodes_data = []
        for node in self._interps:
            node_dict = {
                "key": node.key,
                "expression": node.expression,
                "conversion": node.conversion,
                "format_spec": node.format_spec,
                "render_hints": node.render_hints,
                "index": node.index,
            }
            if isinstance(node.value, list):
                node_dict["value"] = [item.to_provenance() for item in node.value]
            elif isinstance(node.value, StructuredPrompt):
                node_dict["value"] = node.value.to_provenance()
            else:
                node_dict["value"] = node.value
            nodes_data.append(node_dict)

        return {"strings": list(self._template.strings), "nodes": nodes_data}

    def __repr__(self) -> str:
        """Return a helpful debug representation."""
        keys = ", ".join(repr(k) for k in list(self)[:3])
        if len(self) > 3:
            keys += ", ..."
        return f"StructuredPrompt(keys=[{keys}], num_interpolations={len(self._interps)})"


def prompt(template: Template, /, **opts) -> StructuredPrompt:
    """
    Build a StructuredPrompt from a t-string Template.

    This is the main entry point for creating structured prompts.

    Parameters
    ----------
    template : Template
        The Template object from a t-string literal (e.g., t"...").
    **opts
        Additional options passed to StructuredPrompt constructor
        (e.g., allow_duplicate_keys=True).

    Returns
    -------
    StructuredPrompt
        The structured prompt object.

    Raises
    ------
    TypeError
        If template is not a Template object.

    Examples
    --------
    >>> instructions = "Always answer politely."
    >>> p = prompt(t"Obey {instructions:inst}")
    >>> str(p)
    'Obey Always answer politely.'
    >>> p['inst'].expression
    'instructions'
    """
    if not isinstance(template, Template):
        raise TypeError("prompt(...) requires a t-string Template")
    return StructuredPrompt(template, **opts)
