"""Element classes for structured prompts."""

import base64
import io
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal, Optional, Union

from .exceptions import NotANestedPromptError
from .source_location import SourceLocation

if TYPE_CHECKING:
    from .ir import IntermediateRepresentation, RenderContext
    from .structured_prompt import StructuredPrompt

# Type alias for interpolation return types to keep lines under 120 chars
InterpolationType = Union[
    "TextInterpolation",
    "ListInterpolation",
    "ImageInterpolation",
    "StructuredPrompt",
]

# Workaround for Python 3.14.0b3 missing convert function
def convert(value: str, conversion: Literal["r", "s", "a"]) -> str:
    """Apply string conversion (!r, !s, !a) to a value."""
    if conversion == "s":
        return str(value)
    elif conversion == "r":
        return repr(value)
    elif conversion == "a":
        return ascii(value)
    return value


def apply_render_hints(
    ir: "IntermediateRepresentation",
    hints: dict[str, str],
    level: int,
    max_level: int,
    element_id: str,
) -> "IntermediateRepresentation":
    """
    Apply render hints (xml wrapper, header) to an IR using chunk-based operations.

    This helper function ensures consistent application of render hints across
    TextInterpolation, StructuredPrompt, and ListInterpolation.

    Parameters
    ----------
    ir : IntermediateRepresentation
        The IR to wrap with render hints.
    hints : dict[str, str]
        Parsed render hints dictionary (from parse_render_hints).
    level : int
        Current header level from RenderContext.
    max_level : int
        Maximum header level from RenderContext.
    element_id : str
        ID of the element that has these render hints (for wrapper chunks).

    Returns
    -------
    IntermediateRepresentation
        New IR with render hints applied as wrappers.
    """
    # Apply XML wrapper (inner) - wraps the entire content
    if "xml" in hints:
        xml_tag = hints["xml"]
        ir = ir.wrap(f"<{xml_tag}>\n", f"\n</{xml_tag}>", element_id)

    # Apply header (outer) - wraps after XML, only prepends
    if "header" in hints:
        header_level = min(level, max_level)
        ir = ir.wrap(f"{'#' * header_level} {hints['header']}\n", "", element_id)

    return ir


# Try to import PIL for image support (optional dependency)
try:
    from PIL import Image as PILImage

    HAS_PIL = True
except ImportError:
    PILImage = None  # type: ignore
    HAS_PIL = False


@dataclass(slots=True)
class Element(ABC):
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
    source_location : SourceLocation | None
        Source code location information for this element (if available).
    id : str
        Unique identifier for this element (UUID4 string).
    metadata : dict[str, Any]
        Metadata dictionary for storing analysis results and other information.
    """

    key: Union[str, int, None] = None  # None for root StructuredPrompts
    parent: Optional["StructuredPrompt"] = None
    index: int = 0
    source_location: Optional[SourceLocation] = None
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    metadata: dict[str, Any] = field(default_factory=dict)

    # Interpolation fields (None for Static and non-interpolated StructuredPrompts)
    expression: Optional[str] = None
    conversion: Optional[str] = None
    format_spec: Optional[str] = None
    render_hints: Optional[str] = None

    @property
    def is_interpolated(self) -> bool:
        """
        Check if this element has been interpolated into a parent prompt.

        Returns True if the element has interpolation metadata (expression is not None).
        For Static elements and non-interpolated StructuredPrompts, returns False.

        Returns
        -------
        bool
            True if element has been interpolated, False otherwise.
        """
        return self.expression is not None

    @abstractmethod
    def ir(self, ctx: Optional["RenderContext"] = None) -> "IntermediateRepresentation":
        """
        Convert this element to an IntermediateRepresentation.

        Each element type knows how to convert itself to IR, including applying
        render hints, conversions, and handling nested structures.

        Parameters
        ----------
        ctx : RenderContext | None, optional
            Rendering context with path, header level, etc.
            If None, uses default context (path=(), header_level=1, max_header_level=4).

        Returns
        -------
        IntermediateRepresentation
            IR with chunks for this element.
        """
        pass

    def _base_json_dict(self) -> dict[str, Any]:
        """
        Get base fields common to all elements.

        Returns a dictionary with the base fields that all elements share:
        key, index, source_location, id, parent_id, metadata.

        Returns
        -------
        dict[str, Any]
            Dictionary with base fields (without "type" field).
        """
        return {
            "key": self.key,
            "index": self.index,
            "source_location": self.source_location.toJSON() if self.source_location else None,
            "id": self.id,
            "parent_id": self.parent.id if self.parent else None,
            "metadata": self.metadata,
        }

    def _interpolation_json_dict(
        self,
        expression: str,
        conversion: Optional[str],
        format_spec: str,
        render_hints: str,
    ) -> dict[str, Any]:
        """
        Get fields common to all interpolation types.

        This helper returns the fields shared by TextInterpolation,
        NestedPromptInterpolation, ListInterpolation, and ImageInterpolation.

        Parameters
        ----------
        expression : str
            The original expression text from the t-string.
        conversion : str | None
            The conversion flag if present (!s, !r, !a), or None.
        format_spec : str
            The format specification string.
        render_hints : str
            Rendering hints parsed from format_spec.

        Returns
        -------
        dict[str, Any]
            Dictionary with interpolation fields.
        """
        return {
            "expression": expression,
            "conversion": conversion,
            "format_spec": format_spec,
            "render_hints": render_hints,
        }

    @abstractmethod
    def toJSON(self) -> dict[str, Any]:
        """
        Convert this element to a JSON-serializable dictionary.

        Each element type implements its own serialization logic. References to
        objects with IDs (e.g., StructuredPrompt) are serialized as just the ID string.
        The full object dictionaries are stored elsewhere in the JSON structure.

        Returns
        -------
        dict[str, Any]
            JSON-serializable dictionary representing this element.
        """
        pass


@dataclass(slots=True)
class Static(Element):
    """
    Represents a static string segment from the t-string.

    Static segments are the literal text between interpolations.

    Attributes
    ----------
    key : int
        The position of this static in the template's strings tuple.
    parent : StructuredPrompt | None
        The parent StructuredPrompt that contains this static.
    index : int
        The position of this element in the overall element sequence.
    source_location : SourceLocation | None
        Source code location information for this element (if available).
    value : str
        The static text content.
    """

    value: str = ""  # Default not used, but required for dataclass field ordering

    def ir(self, ctx: Optional["RenderContext"] = None) -> "IntermediateRepresentation":
        """
        Convert static text to an IntermediateRepresentation.

        Parameters
        ----------
        ctx : RenderContext | None, optional
            Rendering context. If None, uses default context.

        Returns
        -------
        IntermediateRepresentation
            IR with a single TextChunk (if non-empty).
        """
        from .ir import IntermediateRepresentation, RenderContext

        if ctx is None:
            ctx = RenderContext(path=(), header_level=1, max_header_level=4)

        if not self.value:
            # Empty static - return empty IR
            return IntermediateRepresentation.empty()

        # Use from_text factory method for simple text
        return IntermediateRepresentation.from_text(self.value, self.id)

    def toJSON(self) -> dict[str, Any]:
        """
        Convert Static element to JSON-serializable dictionary.

        Returns
        -------
        dict[str, Any]
            Dictionary with type, key, index, source_location, id, value, parent_id, metadata.
        """
        return {
            "type": "Static",
            **self._base_json_dict(),
            "value": self.value,
        }


@dataclass(slots=True)
class TextInterpolation(Element):
    """
    Immutable record of a text interpolation in a StructuredPrompt.

    Represents interpolations where the value is a string.

    Attributes
    ----------
    key : str
        The key used for dict-like access (parsed from format_spec or expression).
    parent : StructuredPrompt | None
        The parent StructuredPrompt that contains this interpolation.
    index : int
        The position of this element in the overall element sequence.
    source_location : SourceLocation | None
        Source code location information for this element (if available).
    expression : str
        The original expression text from the t-string (what was inside {}).
    conversion : str | None
        The conversion flag if present (!s, !r, !a), or None.
    format_spec : str
        The format specification string (everything after :), or empty string.
    render_hints : str
        Rendering hints parsed from format_spec (everything after first colon in format spec).
    value : str
        The string value.
    """

    # Inherited from Element: expression, conversion, format_spec, render_hints
    value: str = ""

    def __getitem__(self, key: str) -> InterpolationType:
        """
        Raise NotANestedPromptError since text interpolations cannot be indexed.

        Parameters
        ----------
        key : str
            The key attempted to access.

        Raises
        ------
        NotANestedPromptError
            Always, since text interpolations don't support indexing.
        """
        raise NotANestedPromptError(str(self.key))

    def ir(self, ctx: Optional["RenderContext"] = None) -> "IntermediateRepresentation":
        """
        Convert text interpolation to IR with conversions and render hints.

        Applies conversions (!s, !r, !a) and render hints (xml, header) to the text value.

        Parameters
        ----------
        ctx : RenderContext | None, optional
            Rendering context. If None, uses default context.

        Returns
        -------
        IntermediateRepresentation
            IR with chunks including any wrappers.
        """
        from .ir import IntermediateRepresentation, RenderContext
        from .parsing import parse_render_hints

        if ctx is None:
            ctx = RenderContext(path=(), header_level=1, max_header_level=4)

        # Parse render hints
        hints = parse_render_hints(self.render_hints, str(self.key))

        # String value - apply conversion if needed
        text = self.value
        if self.conversion:
            conv: Literal["r", "s", "a"] = self.conversion  # type: ignore
            text = convert(text, conv)
        result_ir = IntermediateRepresentation.from_text(text, self.id)

        # Apply render hints using chunk-based operations
        result_ir = apply_render_hints(result_ir, hints, ctx.header_level, ctx.max_header_level, self.id)

        return result_ir

    def __repr__(self) -> str:
        """Return a helpful debug representation."""
        return (
            f"TextInterpolation(key={self.key!r}, expression={self.expression!r}, "
            f"conversion={self.conversion!r}, format_spec={self.format_spec!r}, "
            f"render_hints={self.render_hints!r}, value={self.value!r}, index={self.index})"
        )

    def toJSON(self) -> dict[str, Any]:
        """
        Convert TextInterpolation to JSON-serializable dictionary.

        Returns
        -------
        dict[str, Any]
            Dictionary with type, key, index, source_location, id, expression,
            conversion, format_spec, render_hints, value, parent_id, metadata.
        """
        return {
            "type": "TextInterpolation",
            **self._base_json_dict(),
            **self._interpolation_json_dict(self.expression, self.conversion, self.format_spec, self.render_hints),
            "value": self.value,
        }


@dataclass(slots=True)
class ListInterpolation(Element):
    """
    Immutable record of a list interpolation in a StructuredPrompt.

    Represents interpolations where the value is a list of StructuredPrompts.
    Stores the separator as a field for proper handling during rendering.

    Attributes
    ----------
    key : str
        The key used for dict-like access (parsed from format_spec or expression).
    parent : StructuredPrompt | None
        The parent StructuredPrompt that contains this interpolation.
    index : int
        The position of this element in the overall element sequence.
    source_location : SourceLocation | None
        Source code location information for this element (if available).
    expression : str
        The original expression text from the t-string (what was inside {}).
    conversion : str | None
        The conversion flag if present (!s, !r, !a), or None.
    format_spec : str
        The format specification string (everything after :), or empty string.
    render_hints : str
        Rendering hints parsed from format_spec (everything after first colon in format spec).
    separator : str
        The separator to use when joining items (parsed from render_hints, default "\n").
    item_elements : list[StructuredPrompt]
        The list items stored directly (attached in __post_init__).
        Each item is attached to the parent StructuredPrompt with an integer key.
        Iterate over this to access items directly.
    """

    # Inherited from Element: expression, conversion, format_spec, render_hints
    items: list["StructuredPrompt"] = field(default=None, repr=False)  # type: ignore  # Temporary, used only in __post_init__
    separator: str = "\n"
    item_elements: list["StructuredPrompt"] = field(default_factory=list)

    def __post_init__(self) -> None:
        """Attach list items directly without wrappers."""
        from .exceptions import PromptReuseError

        # Get items from temporary field
        items = object.__getattribute__(self, 'items')

        # Check for duplicate prompts (disallow reuse in lists)
        seen_ids = set()
        for item in items:
            if item.id in seen_ids:
                raise PromptReuseError(
                    item,
                    None,  # Don't have reference to first occurrence
                    self,
                    message=f"Cannot reuse StructuredPrompt (id={item.id}) in the same list"
                )
            seen_ids.add(item.id)

        # Attach items directly - no wrappers needed
        attached_items = []
        for idx, item in enumerate(items):
            # Check for reuse (item already attached elsewhere)
            if item.parent is not None:
                # Create temp wrapper-like object for error message
                class _TempWrapper:
                    def __init__(self, parent, key):
                        self.parent = parent
                        self.key = key
                old_parent_element = item.parent[item.key] if item.key in item.parent else None
                new_wrapper = _TempWrapper(self.parent, self.key)
                raise PromptReuseError(item, old_parent_element, new_wrapper)

            # Attach the item directly to the parent StructuredPrompt
            item.key = idx  # List items use integer keys
            item.expression = f"[{idx}]"
            item.conversion = None
            item.format_spec = ""
            item.render_hints = ""
            item.parent = self.parent  # Parent is the StructuredPrompt containing this ListInterpolation
            item.index = self.index  # Items share the list's index in parent's children
            # Set source_location to where the list was interpolated (parent's creation location)
            # item._creation_location remains where the item was originally created
            item.source_location = self.source_location

            attached_items.append(item)

        # Store items directly
        object.__setattr__(self, 'item_elements', attached_items)

    def __getitem__(self, idx: int) -> "StructuredPrompt":
        """
        Access list items by index.

        Parameters
        ----------
        idx : int
            The index of the item to access.

        Returns
        -------
        StructuredPrompt
            The item at the given index.

        Raises
        ------
        IndexError
            If the index is out of bounds.
        """
        return self.item_elements[idx]

    def __len__(self) -> int:
        """Return the number of items in the list."""
        return len(self.item_elements)

    def __iter__(self):
        """Iterate over the list items directly."""
        return iter(self.item_elements)

    def ir(self, ctx: Optional["RenderContext"] = None, base_indent: str = "") -> "IntermediateRepresentation":
        """
        Convert list interpolation to IR with separator, base_indent, and render hints.

        Parameters
        ----------
        ctx : RenderContext | None, optional
            Rendering context. If None, uses default context.
        base_indent : str, optional
            Base indentation to add after separator for items after the first.
            Extracted by IR from preceding text.
            NOTE: base_indent support will be added in a future refactor.

        Returns
        -------
        IntermediateRepresentation
            IR with flattened chunks from all items, with wrappers applied.
        """
        from .ir import IntermediateRepresentation, RenderContext
        from .parsing import parse_render_hints

        if ctx is None:
            ctx = RenderContext(path=(), header_level=1, max_header_level=4)

        # Parse render hints
        hints = parse_render_hints(self.render_hints, str(self.key))

        # Render each item directly (items are now StructuredPrompts, not wrappers)
        item_irs = [item.ir(ctx) for item in self.item_elements]

        # Merge items with separator using chunk-based merge operation
        # The separator chunks will have element_id = self.id (the ListInterpolation)
        merged_ir = IntermediateRepresentation.merge(item_irs, separator=self.separator, separator_element_id=self.id)

        # Apply render hints using chunk-based operations
        result_ir = apply_render_hints(merged_ir, hints, ctx.header_level, ctx.max_header_level, self.id)

        return result_ir

    def __repr__(self) -> str:
        """Return a helpful debug representation."""
        return (
            f"ListInterpolation(key={self.key!r}, expression={self.expression!r}, "
            f"separator={self.separator!r}, items={len(self.item_elements)}, index={self.index})"
        )

    def toJSON(self) -> dict[str, Any]:
        """
        Convert ListInterpolation to JSON-serializable dictionary.

        The list of StructuredPrompt items is serialized as a list of ID strings.
        The full StructuredPrompt objects will be stored elsewhere in the JSON structure.

        Returns
        -------
        dict[str, Any]
            Dictionary with type, key, index, source_location, id, expression,
            conversion, format_spec, render_hints, item_ids, separator, parent_id, metadata.
        """
        return {
            "type": "ListInterpolation",
            **self._base_json_dict(),
            **self._interpolation_json_dict(self.expression, self.conversion, self.format_spec, self.render_hints),
            "item_ids": [item.id for item in self.item_elements],
            "separator": self.separator,
        }


@dataclass(slots=True)
class ImageInterpolation(Element):
    """
    Immutable record of an image interpolation in a StructuredPrompt.

    Represents interpolations where the value is a PIL Image object.
    Cannot be rendered to text - raises ImageRenderError when attempting to render.

    Attributes
    ----------
    key : str
        The key used for dict-like access (parsed from format_spec or expression).
    parent : StructuredPrompt | None
        The parent StructuredPrompt that contains this interpolation.
    index : int
        The position of this element in the overall element sequence.
    source_location : SourceLocation | None
        Source code location information for this element (if available).
    expression : str
        The original expression text from the t-string (what was inside {}).
    conversion : str | None
        The conversion flag if present (!s, !r, !a), or None.
    format_spec : str
        The format specification string (everything after :), or empty string.
    render_hints : str
        Rendering hints parsed from format_spec (everything after first colon in format spec).
    value : Any
        The PIL Image object (typed as Any to avoid hard dependency on PIL).
    """

    # Inherited from Element: expression, conversion, format_spec, render_hints
    value: Any = None  # PIL Image type

    def ir(self, ctx: Optional["RenderContext"] = None) -> "IntermediateRepresentation":
        """
        Convert image to an IntermediateRepresentation with an ImageChunk.

        Parameters
        ----------
        ctx : RenderContext | None, optional
            Rendering context. If None, uses default context.

        Returns
        -------
        IntermediateRepresentation
            IR with a single ImageChunk.
        """
        from .ir import IntermediateRepresentation, RenderContext

        if ctx is None:
            ctx = RenderContext(path=(), header_level=1, max_header_level=4)

        # Use from_image factory method for images
        return IntermediateRepresentation.from_image(self.value, self.id)

    def __repr__(self) -> str:
        """Return a helpful debug representation."""
        return (
            f"ImageInterpolation(key={self.key!r}, expression={self.expression!r}, "
            f"value=<PIL.Image>, index={self.index})"
        )

    def toJSON(self) -> dict[str, Any]:
        """
        Convert ImageInterpolation to JSON-serializable dictionary.

        The PIL Image value is serialized using _serialize_image to include
        base64 data and metadata.

        Returns
        -------
        dict[str, Any]
            Dictionary with type, key, index, source_location, id, expression,
            conversion, format_spec, render_hints, value, parent_id, metadata.
        """
        return {
            "type": "ImageInterpolation",
            **self._base_json_dict(),
            **self._interpolation_json_dict(self.expression, self.conversion, self.format_spec, self.render_hints),
            "value": _serialize_image(self.value),
        }


def _serialize_image(image: Any) -> dict[str, Any]:
    """
    Serialize a PIL Image to a JSON-compatible dict with base64 data and metadata.

    Parameters
    ----------
    image : PIL.Image.Image
        The PIL Image object to serialize.

    Returns
    -------
    dict[str, Any]
        Dictionary with base64_data, format, size (width, height), mode, and other metadata.
    """
    if not HAS_PIL or PILImage is None:
        return {"error": "PIL not available"}

    try:
        # Get image metadata
        width, height = image.size
        mode = image.mode
        img_format = image.format or "PNG"  # Default to PNG if format not set

        # Encode image to base64
        buffer = io.BytesIO()
        image.save(buffer, format=img_format)
        base64_data = base64.b64encode(buffer.getvalue()).decode("utf-8")

        return {
            "base64_data": base64_data,
            "format": img_format,
            "width": width,
            "height": height,
            "mode": mode,
        }
    except Exception as e:
        return {"error": f"Failed to serialize image: {e}"}
