"""StructuredPrompt class and top-level functions."""

import uuid
from collections.abc import Iterable, Mapping
from string.templatelib import Template
from typing import TYPE_CHECKING, Any, Optional, Union

from .element import (
    HAS_PIL,
    Element,
    ImageInterpolation,
    InterpolationType,
    ListInterpolation,
    NestedPromptInterpolation,
    PILImage,
    Static,
    TextInterpolation,
)
from .exceptions import DuplicateKeyError, EmptyExpressionError, MissingKeyError, UnsupportedValueTypeError
from .parsing import parse_format_spec as _parse_format_spec
from .parsing import parse_separator as _parse_separator
from .source_location import SourceLocation, _capture_source_location
from .text import process_dedent as _process_dedent

if TYPE_CHECKING:
    from .ir import IntermediateRepresentation


class StructuredPrompt(Mapping[str, InterpolationType]):
    """
    A provenance-preserving, navigable tree representation of a t-string.

    StructuredPrompt wraps a string.templatelib.Template (from a t-string)
    and provides dict-like access to its interpolations, preserving full
    provenance information (expression, conversion, format_spec, value).

    Attributes
    ----------
    metadata : dict[str, Any]
        Metadata dictionary for storing analysis results and other information.
    parent_element : NestedPromptInterpolation | ListInterpolation | None
        The parent element that contains this StructuredPrompt (if nested).
        None for root prompts. Enables upward tree traversal.

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

    def __init__(
        self,
        template: Template,
        *,
        allow_duplicate_keys: bool = False,
        _processed_strings: Optional[tuple[str, ...]] = None,
        _source_location: Optional[SourceLocation] = None,
    ):
        self._template = template
        self._processed_strings = _processed_strings  # Dedented/trimmed strings if provided
        self._source_location = _source_location  # Source location for all elements in this prompt
        self._id = str(uuid.uuid4())  # Unique identifier for this StructuredPrompt
        self.metadata: dict[str, Any] = {}  # Metadata dictionary for storing analysis results
        # Parent element for upward traversal
        self.parent_element: Optional[Union[NestedPromptInterpolation, ListInterpolation]] = None
        # All children (Static, StructuredInterpolation, ListInterpolation, ImageInterpolation)
        self._children: list[Element] = []
        # Only interpolations
        self._interps: list[InterpolationType] = []
        self._allow_duplicates = allow_duplicate_keys

        # Index maps keys to interpolation indices (within _interps list)
        # If allow_duplicates, maps to list of indices; otherwise, maps to single index
        self._index: dict[str, Union[int, list[int]]] = {}

        self._build_nodes()

    def _build_nodes(self) -> None:
        """Build Element nodes (Static and StructuredInterpolation) from the template."""
        # Use processed strings if available (from dedenting), otherwise use original
        strings = self._processed_strings if self._processed_strings is not None else self._template.strings
        interpolations = self._template.interpolations

        element_idx = 0  # Overall position in element sequence
        interp_idx = 0  # Position within interpolations list

        # Interleave statics and interpolations
        for static_key, static_text in enumerate(strings):
            # Add static element
            static = Static(
                key=static_key,
                value=static_text,
                parent=self,
                index=element_idx,
                source_location=self._source_location,
            )
            self._children.append(static)
            element_idx += 1

            # Add interpolation if there's one after this static
            if static_key < len(interpolations):
                itp = interpolations[static_key]

                # Parse format spec to extract key and render hints
                key, render_hints = _parse_format_spec(itp.format_spec, itp.expression)

                # Guard against empty keys
                if not key:
                    raise EmptyExpressionError()

                # Validate and extract value - create appropriate node type
                val = itp.value
                if isinstance(val, list):
                    # Check that all items in the list are StructuredPrompts
                    if not all(isinstance(item, StructuredPrompt) for item in val):
                        raise UnsupportedValueTypeError(key, type(val), itp.expression)

                    # Create ListInterpolation node
                    separator = _parse_separator(render_hints)
                    node = ListInterpolation(
                        key=key,
                        expression=itp.expression,
                        conversion=itp.conversion,
                        format_spec=itp.format_spec,
                        render_hints=render_hints,
                        items=val,
                        separator=separator,
                        parent=self,
                        index=element_idx,
                        source_location=self._source_location,
                    )
                elif HAS_PIL and PILImage and isinstance(val, PILImage.Image):
                    # Create ImageInterpolation node
                    node = ImageInterpolation(
                        key=key,
                        expression=itp.expression,
                        conversion=itp.conversion,
                        format_spec=itp.format_spec,
                        render_hints=render_hints,
                        value=val,
                        parent=self,
                        index=element_idx,
                        source_location=self._source_location,
                    )
                elif isinstance(val, StructuredPrompt):
                    # Create NestedPromptInterpolation node
                    node = NestedPromptInterpolation(
                        key=key,
                        expression=itp.expression,
                        conversion=itp.conversion,
                        format_spec=itp.format_spec,
                        render_hints=render_hints,
                        value=val,
                        parent=self,
                        index=element_idx,
                        source_location=self._source_location,
                    )
                elif isinstance(val, str):
                    # Create TextInterpolation node
                    node = TextInterpolation(
                        key=key,
                        expression=itp.expression,
                        conversion=itp.conversion,
                        format_spec=itp.format_spec,
                        render_hints=render_hints,
                        value=val,
                        parent=self,
                        index=element_idx,
                        source_location=self._source_location,
                    )
                else:
                    raise UnsupportedValueTypeError(key, type(val), itp.expression)

                self._interps.append(node)
                self._children.append(node)
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

    def __getitem__(self, key: str) -> InterpolationType:
        """
        Get the interpolation node for the given key.

        Parameters
        ----------
        key : str
            The key to look up (derived from format_spec or expression).

        Returns
        -------
        TextInterpolation | NestedPromptInterpolation | ListInterpolation | ImageInterpolation
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

    def get_all(self, key: str) -> list[InterpolationType]:
        """
        Get all interpolation nodes for a given key (for duplicate keys).

        Parameters
        ----------
        key : str
            The key to look up.

        Returns
        -------
        list[TextInterpolation | NestedPromptInterpolation | ListInterpolation | ImageInterpolation]
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
    def id(self) -> str:
        """Return the unique identifier for this StructuredPrompt."""
        return self._id

    @property
    def template(self) -> Template:
        """Return the original Template object."""
        return self._template

    @property
    def strings(self) -> tuple[str, ...]:
        """Return the static string segments from the template."""
        return self._template.strings

    @property
    def interpolations(self) -> tuple[InterpolationType, ...]:
        """Return all interpolation nodes in order."""
        return tuple(self._interps)

    @property
    def children(self) -> tuple[Element, ...]:
        """Return all children (Static and StructuredInterpolation) in order."""
        return tuple(self._children)

    # Parent element management

    def _set_parent_element(self, parent: Union[NestedPromptInterpolation, ListInterpolation]) -> None:
        """
        Set the parent element for this StructuredPrompt.

        This method enables upward tree traversal by linking nested prompts back
        to their containing elements. It enforces the single-parent constraint:
        each StructuredPrompt can only be nested in one location at a time.

        Parameters
        ----------
        parent : NestedPromptInterpolation | ListInterpolation
            The parent element that contains this StructuredPrompt.

        Raises
        ------
        PromptReuseError
            If this StructuredPrompt is already nested in a different location.
            The error will not be raised if called multiple times with the same parent
            (idempotent operation).

        Notes
        -----
        This method is called automatically by NestedPromptInterpolation and
        ListInterpolation during construction. Users typically don't need to
        call this method directly.

        Examples
        --------
        This method is called automatically when nesting prompts:

        >>> inner = prompt(t"inner")
        >>> outer = prompt(t"{inner:i}")  # Calls inner._set_parent_element(outer['i'])
        >>> inner.parent_element is outer['i']
        True

        Attempting to reuse the same prompt instance will raise an error:

        >>> inner = prompt(t"inner")
        >>> outer1 = prompt(t"{inner:i}")
        >>> outer2 = prompt(t"{inner:j}")  # Raises PromptReuseError
        """
        from .exceptions import PromptReuseError

        # If already set to the same parent, do nothing (idempotent)
        if self.parent_element is parent:
            return

        # If already set to a different parent, raise error
        if self.parent_element is not None:
            raise PromptReuseError(self, self.parent_element, parent)

        # Set the parent
        self.parent_element = parent

    # Rendering

    def ir(
        self, _path: tuple[Union[str, int], ...] = (), max_header_level: int = 4, _header_level: int = 1
    ) -> "IntermediateRepresentation":
        """
        Convert this StructuredPrompt to an IntermediateRepresentation with source mapping.

        Each chunk contains an element_id that maps it back to its source element.
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
        max_header_level : int, optional
            Maximum header level for markdown headers (default: 4).
        _header_level : int
            Internal parameter for tracking current header nesting level.

        Returns
        -------
        IntermediateRepresentation
            Object containing chunks with source mapping via element_id.
        """
        from .ir import IntermediateRepresentation, RenderContext

        # Create render context
        ctx = RenderContext(path=_path, header_level=_header_level, max_header_level=max_header_level)

        # Convert each element to IR
        element_irs = [element.ir(ctx) for element in self._children]

        # Merge all element IRs (no separator - children are already interleaved with statics)
        merged_ir = IntermediateRepresentation.merge(element_irs, separator="")

        # Create final IR with source_prompt set to self
        return IntermediateRepresentation(
            chunks=merged_ir.chunks,
            source_prompt=self,
        )

    def __str__(self) -> str:
        """Render to string (convenience for ir().text)."""
        return self.ir().text

    def toJSON(self) -> dict[str, Any]:
        """
        Export complete structured prompt as hierarchical JSON tree.

        This method provides a comprehensive JSON representation optimized for analysis
        and traversal, using a natural tree structure with explicit children arrays and
        parent references.

        The output has a root structure with:
        1. **prompt_id**: UUID of the root StructuredPrompt
        2. **children**: Array of child elements, each with their own children if nested

        Each element includes:
        - **parent_id**: UUID of the parent element (enables upward traversal)
        - **children**: Array of nested elements (for nested_prompt and list types)

        Images are serialized as base64-encoded data with metadata (format, size, mode).

        Returns
        -------
        dict[str, Any]
            JSON-serializable dictionary with 'prompt_id' and 'children' keys.

        Examples
        --------
        >>> x = "value"
        >>> p = prompt(t"{x:x}")
        >>> data = p.toJSON()
        >>> data.keys()
        dict_keys(['prompt_id', 'children'])
        >>> len(data['children'])  # Static "", interpolation, static ""
        3
        """

        def _build_element_tree(element: Element, parent_id: str) -> dict[str, Any]:
            """Build JSON representation of a single element with its children."""
            from .element import _serialize_image
            from .source_location import _serialize_source_location

            base = {
                "type": "",  # Will be set below
                "id": element.id,
                "parent_id": parent_id,
                "key": element.key,
                "index": element.index,
                "source_location": _serialize_source_location(element.source_location),
            }

            if isinstance(element, Static):
                base["type"] = "static"
                base["value"] = element.value

            elif isinstance(element, NestedPromptInterpolation):
                base["type"] = "nested_prompt"
                base.update({
                    "expression": element.expression,
                    "conversion": element.conversion,
                    "format_spec": element.format_spec,
                    "render_hints": element.render_hints,
                    "prompt_id": element.value.id,
                })
                # Nested prompt - recurse
                base["children"] = _build_children_tree(element.value, element.id)

            elif isinstance(element, TextInterpolation):
                base["type"] = "interpolation"
                base.update({
                    "expression": element.expression,
                    "conversion": element.conversion,
                    "format_spec": element.format_spec,
                    "render_hints": element.render_hints,
                    "value": element.value,
                })

            elif isinstance(element, ListInterpolation):
                base["type"] = "list"
                base.update({
                    "expression": element.expression,
                    "conversion": element.conversion,
                    "format_spec": element.format_spec,
                    "render_hints": element.render_hints,
                    "separator": element.separator,
                })
                # Build array of wrapper elements (NestedPromptInterpolation for each item)
                base["children"] = [_build_element_tree(wrapper, element.id) for wrapper in element.item_elements]

            elif isinstance(element, ImageInterpolation):
                base["type"] = "image"
                base.update({
                    "expression": element.expression,
                    "conversion": element.conversion,
                    "format_spec": element.format_spec,
                    "render_hints": element.render_hints,
                    "image_data": _serialize_image(element.value),
                })

            return base

        def _build_children_tree(prompt: "StructuredPrompt", parent_id: str) -> list[dict[str, Any]]:
            """Build children array for a prompt."""
            return [_build_element_tree(elem, parent_id) for elem in prompt.children]

        return {"prompt_id": self._id, "children": _build_children_tree(self, self._id)}

    def __repr__(self) -> str:
        """Return a helpful debug representation."""
        keys = ", ".join(repr(k) for k in list(self)[:3])
        if len(self) > 3:
            keys += ", ..."
        return f"StructuredPrompt(keys=[{keys}], num_interpolations={len(self._interps)})"

    def _repr_html_(self) -> str:
        """
        Return HTML representation for Jupyter notebook display.

        This method is automatically called by Jupyter/IPython when displaying
        a StructuredPrompt in a notebook cell.

        Returns
        -------
        str
            HTML string with widget visualization.
        """
        # Create IR, compile it, and use CompiledIR's HTML representation
        ir = self.ir()
        compiled = ir.compile()
        return compiled._repr_html_()


def prompt(
    template: Template,
    /,
    *,
    dedent: bool = False,
    trim_leading: bool = True,
    trim_empty_leading: bool = True,
    trim_trailing: bool = True,
    capture_source_location: bool = True,
    **opts,
) -> StructuredPrompt:
    """
    Build a StructuredPrompt from a t-string Template with optional dedenting.

    This is the main entry point for creating structured prompts. Supports automatic
    dedenting and trimming to make indented t-strings in source code more readable.

    Parameters
    ----------
    template : Template
        The Template object from a t-string literal (e.g., t"...").
    dedent : bool, optional
        If True, dedent all static text by the indent level of the first non-empty line.
        Default is False (no dedenting).
    trim_leading : bool, optional
        If True, remove the first line of the first static if it's whitespace-only
        and ends in a newline. Default is True.
    trim_empty_leading : bool, optional
        If True, remove empty lines (just newlines) after the first line in the
        first static. Default is True.
    trim_trailing : bool, optional
        If True, remove trailing newlines from the last static. Default is True.
    capture_source_location : bool, optional
        If True, capture source code location information for all elements.
        Default is True. Set to False to disable (improves performance).
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
    DedentError
        If dedenting fails due to invalid configuration or mixed tabs/spaces.

    Examples
    --------
    Basic usage:
    >>> instructions = "Always answer politely."
    >>> p = prompt(t"Obey {instructions:inst}")
    >>> str(p)
    'Obey Always answer politely.'
    >>> p['inst'].expression
    'instructions'

    With dedenting:
    >>> p = prompt(t\"\"\"
    ...     You are a helpful assistant.
    ...     Task: {task:t}
    ... \"\"\", dedent=True)
    >>> print(str(p))
    You are a helpful assistant.
    Task: ...

    Disable source location capture for performance:
    >>> p = prompt(t"Hello {name}", capture_source_location=False)
    """
    if not isinstance(template, Template):
        raise TypeError("prompt(...) requires a t-string Template")

    # Capture source location if enabled
    source_location = _capture_source_location() if capture_source_location else None

    # Apply dedenting/trimming if any are enabled
    if dedent or trim_leading or trim_empty_leading or trim_trailing:
        processed_strings = _process_dedent(
            template.strings,
            dedent=dedent,
            trim_leading=trim_leading,
            trim_empty_leading=trim_empty_leading,
            trim_trailing=trim_trailing,
        )
        # Create a new Template with processed strings
        # We need to pass the processed strings to StructuredPrompt
        return StructuredPrompt(
            template, _processed_strings=processed_strings, _source_location=source_location, **opts
        )

    return StructuredPrompt(template, _source_location=source_location, **opts)


def dedent(
    template: Template,
    /,
    *,
    trim_leading: bool = True,
    trim_empty_leading: bool = True,
    trim_trailing: bool = True,
    **opts,
) -> StructuredPrompt:
    """
    Build a StructuredPrompt from a t-string Template with dedenting enabled.

    This is a convenience function that forwards to `prompt()` with `dedent=True`.
    Use this when writing indented multi-line prompts to keep your source code
    readable while producing clean output without indentation.

    Parameters
    ----------
    template : Template
        The Template object from a t-string literal (e.g., t"...").
    trim_leading : bool, optional
        If True, remove the first line of the first static if it's whitespace-only
        and ends in a newline. Default is True.
    trim_empty_leading : bool, optional
        If True, remove empty lines (just newlines) after the first line in the
        first static. Default is True.
    trim_trailing : bool, optional
        If True, remove trailing newlines from the last static. Default is True.
    **opts
        Additional options passed to StructuredPrompt constructor
        (e.g., allow_duplicate_keys=True).

    Returns
    -------
    StructuredPrompt
        The structured prompt object with dedenting applied.

    Raises
    ------
    TypeError
        If template is not a Template object.
    DedentError
        If dedenting fails due to invalid configuration or mixed tabs/spaces.

    Examples
    --------
    >>> task = "translate to French"
    >>> p = dedent(t\"\"\"
    ...     You are a helpful assistant.
    ...     Task: {task:t}
    ...     Please respond.
    ... \"\"\")
    >>> print(str(p))
    You are a helpful assistant.
    Task: translate to French
    Please respond.
    """
    return prompt(
        template,
        dedent=True,
        trim_leading=trim_leading,
        trim_empty_leading=trim_empty_leading,
        trim_trailing=trim_trailing,
        **opts,
    )
