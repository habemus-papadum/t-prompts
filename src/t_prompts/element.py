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
    "NestedPromptInterpolation",
    "ListInterpolation",
    "ImageInterpolation",
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
    TextInterpolation, NestedPromptInterpolation, and ListInterpolation.

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


@dataclass(frozen=True, slots=True)
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

    key: Union[str, int]
    parent: Optional["StructuredPrompt"]
    index: int
    source_location: Optional[SourceLocation] = None
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    metadata: dict[str, Any] = field(default_factory=dict)

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


@dataclass(frozen=True, slots=True)
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
            "key": self.key,
            "index": self.index,
            "source_location": self.source_location.toJSON() if self.source_location else None,
            "id": self.id,
            "value": self.value,
            "parent_id": self.parent.id if self.parent else None,
            "metadata": self.metadata,
        }


@dataclass(frozen=True, slots=True)
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

    expression: str = ""
    conversion: Optional[str] = None
    format_spec: str = ""
    render_hints: str = ""
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
            "key": self.key,
            "index": self.index,
            "source_location": self.source_location.toJSON() if self.source_location else None,
            "id": self.id,
            "expression": self.expression,
            "conversion": self.conversion,
            "format_spec": self.format_spec,
            "render_hints": self.render_hints,
            "value": self.value,
            "parent_id": self.parent.id if self.parent else None,
            "metadata": self.metadata,
        }


@dataclass(frozen=True, slots=True)
class NestedPromptInterpolation(Element):
    """
    Immutable record of a nested prompt interpolation in a StructuredPrompt.

    Represents interpolations where the value is a nested StructuredPrompt.

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
    value : StructuredPrompt
        The nested StructuredPrompt value.
    """

    expression: str = ""
    conversion: Optional[str] = None
    format_spec: str = ""
    render_hints: str = ""
    value: "StructuredPrompt" = None  # type: ignore

    def __post_init__(self) -> None:
        """Set parent element link after construction."""
        # Set the parent_element link on the nested StructuredPrompt
        # This allows upward tree traversal from the nested prompt
        self.value._set_parent_element(self)

    def __getitem__(self, key: str) -> InterpolationType:
        """
        Delegate dict-like access to nested StructuredPrompt.

        Parameters
        ----------
        key : str
            The key to look up in the nested prompt.

        Returns
        -------
        TextInterpolation | NestedPromptInterpolation | ListInterpolation | ImageInterpolation
            The interpolation node from the nested prompt.
        """
        return self.value[key]

    def ir(self, ctx: Optional["RenderContext"] = None) -> "IntermediateRepresentation":
        """
        Convert nested prompt interpolation to IR with render hints.

        Recursively converts the nested StructuredPrompt with updated context
        and applies render hints (xml, header).

        Parameters
        ----------
        ctx : RenderContext | None, optional
            Rendering context. If None, uses default context.

        Returns
        -------
        IntermediateRepresentation
            IR with chunks including any wrappers.
        """
        from .ir import RenderContext
        from .parsing import parse_render_hints

        if ctx is None:
            ctx = RenderContext(path=(), header_level=1, max_header_level=4)

        # Parse render hints
        hints = parse_render_hints(self.render_hints, str(self.key))

        # Nested prompt - convert recursively with updated context
        next_level = ctx.header_level + 1 if "header" in hints else ctx.header_level
        nested_ctx_args = {
            "_path": ctx.path + (self.key,),
            "_header_level": next_level,
            "max_header_level": ctx.max_header_level,
        }
        result_ir = self.value.ir(**nested_ctx_args)

        # Apply render hints using chunk-based operations
        result_ir = apply_render_hints(result_ir, hints, ctx.header_level, ctx.max_header_level, self.id)

        return result_ir

    def __repr__(self) -> str:
        """Return a helpful debug representation."""
        return (
            f"NestedPromptInterpolation(key={self.key!r}, expression={self.expression!r}, "
            f"conversion={self.conversion!r}, format_spec={self.format_spec!r}, "
            f"render_hints={self.render_hints!r}, value=StructuredPrompt(...), index={self.index})"
        )

    def toJSON(self) -> dict[str, Any]:
        """
        Convert NestedPromptInterpolation to JSON-serializable dictionary.

        The nested StructuredPrompt value is serialized as just its ID string.
        The full StructuredPrompt object will be stored elsewhere in the JSON structure.

        Returns
        -------
        dict[str, Any]
            Dictionary with type, key, index, source_location, id, expression,
            conversion, format_spec, render_hints, value_id, parent_id, metadata.
        """
        return {
            "type": "NestedPromptInterpolation",
            "key": self.key,
            "index": self.index,
            "source_location": self.source_location.toJSON() if self.source_location else None,
            "id": self.id,
            "expression": self.expression,
            "conversion": self.conversion,
            "format_spec": self.format_spec,
            "render_hints": self.render_hints,
            "value_id": self.value.id,
            "parent_id": self.parent.id if self.parent else None,
            "metadata": self.metadata,
        }


@dataclass(frozen=True, slots=True)
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
    items : list[StructuredPrompt]
        The list of StructuredPrompt items.
    separator : str
        The separator to use when joining items (parsed from render_hints, default "\n").
    """

    expression: str = ""
    conversion: Optional[str] = None
    format_spec: str = ""
    render_hints: str = ""
    items: list["StructuredPrompt"] = None  # type: ignore
    separator: str = "\n"

    def __post_init__(self) -> None:
        """Set parent element links for all items after construction."""
        # Set the parent_element link on each item in the list
        # This allows upward tree traversal from list items
        # Will automatically error if same prompt appears twice (Option A)
        for item in self.items:
            item._set_parent_element(self)

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
        return self.items[idx]

    def __len__(self) -> int:
        """Return the number of items in the list."""
        return len(self.items)

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

        # Convert each item to IR with updated context
        next_level = ctx.header_level + 1 if "header" in hints else ctx.header_level
        item_ctx_args = {
            "_path": ctx.path + (self.key,),
            "_header_level": next_level,
            "max_header_level": ctx.max_header_level,
        }

        item_irs = [item.ir(**item_ctx_args) for item in self.items]

        # Merge items with separator using chunk-based merge operation
        # TODO: Add support for base_indent in a future refactor
        merged_ir = IntermediateRepresentation.merge(item_irs, separator=self.separator, separator_element_id=self.id)

        # Apply render hints using chunk-based operations
        result_ir = apply_render_hints(merged_ir, hints, ctx.header_level, ctx.max_header_level, self.id)

        return result_ir

    def __repr__(self) -> str:
        """Return a helpful debug representation."""
        return (
            f"ListInterpolation(key={self.key!r}, expression={self.expression!r}, "
            f"separator={self.separator!r}, items={len(self.items)}, index={self.index})"
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
            "key": self.key,
            "index": self.index,
            "source_location": self.source_location.toJSON() if self.source_location else None,
            "id": self.id,
            "expression": self.expression,
            "conversion": self.conversion,
            "format_spec": self.format_spec,
            "render_hints": self.render_hints,
            "item_ids": [item.id for item in self.items],
            "separator": self.separator,
            "parent_id": self.parent.id if self.parent else None,
            "metadata": self.metadata,
        }


@dataclass(frozen=True, slots=True)
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

    expression: str = ""
    conversion: Optional[str] = None
    format_spec: str = ""
    render_hints: str = ""
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
            "key": self.key,
            "index": self.index,
            "source_location": self.source_location.toJSON() if self.source_location else None,
            "id": self.id,
            "expression": self.expression,
            "conversion": self.conversion,
            "format_spec": self.format_spec,
            "render_hints": self.render_hints,
            "value": _serialize_image(self.value),
            "parent_id": self.parent.id if self.parent else None,
            "metadata": self.metadata,
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
