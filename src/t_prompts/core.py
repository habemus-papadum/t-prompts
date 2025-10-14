"""Core implementation of structured prompts."""

import inspect
import uuid
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from pathlib import Path
from string.templatelib import Template
from typing import Any, Literal, Optional, Union

from .exceptions import (
    DedentError,
    DuplicateKeyError,
    EmptyExpressionError,
    ImageRenderError,
    MissingKeyError,
    NotANestedPromptError,
    UnsupportedValueTypeError,
)


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

# Try to import PIL for image support (optional dependency)
try:
    from PIL import Image as PILImage
    HAS_PIL = True
except ImportError:
    PILImage = None  # type: ignore
    HAS_PIL = False


@dataclass(frozen=True, slots=True)
class SourceLocation:
    """
    Source code location information for an Element.

    All fields are optional to handle cases where source information is unavailable
    (e.g., REPL, eval, exec). Use the is_available property to check if location
    information is present.

    This information is captured directly from Python stack frames without reading
    source files, making it fast and lightweight.

    Attributes
    ----------
    filename : str | None
        Short filename (e.g., 'script.py', '<stdin>', '<string>').
    filepath : str | None
        Full absolute path to the file.
    line : int | None
        Line number where prompt was created (1-indexed).
    """

    filename: Optional[str] = None
    filepath: Optional[str] = None
    line: Optional[int] = None

    @property
    def is_available(self) -> bool:
        """
        Check if source location information is available.

        Returns
        -------
        bool
            True if location info is present (filename is not None), False otherwise.
        """
        return self.filename is not None

    def format_location(self) -> str:
        """
        Format location as a readable string.

        Returns
        -------
        str
            Formatted location string (e.g., "script.py:42" or "<unavailable>").
        """
        if not self.is_available:
            return "<unavailable>"
        parts = [self.filename or "<unknown>"]
        if self.line is not None:
            parts.append(str(self.line))
        return ":".join(parts)


def _capture_source_location() -> Optional[SourceLocation]:
    """
    Capture source code location information from the call stack.

    Walks up the stack to find the first frame outside this library
    (the actual user code that called prompt()). Only uses information
    directly available from the stack frame without reading source files.

    Returns
    -------
    SourceLocation | None
        Source location if available, None if unavailable.
    """
    # Walk up the stack to find the first non-library frame
    frame = inspect.currentframe()
    if frame is None:
        return None

    # Get the directory of this library to identify internal frames
    library_dir = str(Path(__file__).parent.resolve())

    try:
        # Skip frames until we're out of this library
        while frame is not None:
            frame_file = frame.f_code.co_filename

            # Check if we're outside the library
            if not frame_file.startswith(library_dir):
                # Found user code frame - extract info directly from frame
                filename = Path(frame_file).name
                filepath = str(Path(frame_file).resolve())
                lineno = frame.f_lineno

                return SourceLocation(
                    filename=filename,
                    filepath=filepath,
                    line=lineno,
                )

            frame = frame.f_back
    finally:
        # Clean up frame references to avoid reference cycles
        del frame

    return None


def _process_dedent(
    strings: tuple[str, ...],
    *,
    dedent: bool,
    trim_leading: bool,
    trim_empty_leading: bool,
    trim_trailing: bool
) -> tuple[str, ...]:
    """
    Process dedenting and trimming on template strings.

    This function applies four optional transformations to the static text segments
    of a t-string template:

    1. **Trim leading line** (trim_leading): Remove the first line of the first static
       if it ends in newline and contains only whitespace.
    2. **Trim empty leading lines** (trim_empty_leading): After removing the first line,
       remove any subsequent lines that are empty (just newline with no whitespace).
    3. **Trim trailing lines** (trim_trailing): Remove trailing lines that are just
       newlines from the last static.
    4. **Dedent** (dedent): Find the first non-empty line across all statics, count
       its leading spaces, and remove that many spaces from every line in all statics.

    Parameters
    ----------
    strings : tuple[str, ...]
        The static text segments from the t-string template.
    dedent : bool
        If True, dedent all lines by the indent level of the first non-empty line.
    trim_leading : bool
        If True, remove the first line if it's whitespace-only ending in newline.
    trim_empty_leading : bool
        If True, remove empty lines after the first line in the first static.
    trim_trailing : bool
        If True, remove trailing newline-only lines from the last static.

    Returns
    -------
    tuple[str, ...]
        The processed strings tuple.

    Raises
    ------
    DedentError
        If trim_leading=True but first line doesn't match the required pattern,
        or if mixed tabs and spaces are found in indentation.
    """
    if not strings:
        return strings

    # Convert to list for mutation
    result = list(strings)

    # Step 1: Trim leading line
    if trim_leading and result[0]:
        first = result[0]
        # Check if first line ends in newline and contains only whitespace
        if "\n" in first:
            first_line_end = first.index("\n") + 1
            first_line = first[:first_line_end]
            # Check if it's whitespace-only (excluding the newline)
            if first_line[:-1].strip() == "":
                # Remove this line
                result[0] = first[first_line_end:]
        elif first.startswith("\n"):
            # Special case: starts with newline (empty first line)
            result[0] = first[1:]

    # Step 2: Trim empty leading lines
    if trim_empty_leading and result[0]:
        first = result[0]
        # Remove lines that are just "\n" (no whitespace, just newline)
        while first.startswith("\n"):
            first = first[1:]
        result[0] = first

    # Step 3: Trim trailing lines
    if trim_trailing and result[-1]:
        last = result[-1]
        # Remove all trailing whitespace (including newlines and spaces)
        # Split into lines and work backwards
        if last:
            lines = last.split("\n")
            # Remove trailing empty/whitespace-only lines
            while lines and lines[-1].strip() == "":
                lines.pop()
            # Rejoin
            result[-1] = "\n".join(lines)

    # Step 4: Dedent
    if dedent:
        # Find the first non-empty line or whitespace-only line to determine indent level
        indent_level = None
        for s in result:
            if not s:
                continue
            lines = s.split("\n")
            for line in lines:
                if line.strip():  # Non-empty line with content
                    # Count leading spaces
                    leading = line[:len(line) - len(line.lstrip())]
                    # Check for tabs
                    if "\t" in leading:
                        raise DedentError("Mixed tabs and spaces in indentation are not allowed")
                    indent_level = len(leading)
                    break
                elif line:  # Whitespace-only line (but not empty string)
                    # Also consider whitespace-only lines for indent level
                    # Check for tabs
                    if "\t" in line:
                        raise DedentError("Mixed tabs and spaces in indentation are not allowed")
                    # Use this as indent level if we haven't found one yet
                    if indent_level is None:
                        indent_level = len(line)
            if indent_level is not None:
                break

        # Apply dedenting if we found an indent level
        if indent_level is not None and indent_level > 0:
            for i, s in enumerate(result):
                if not s:
                    continue
                lines = s.split("\n")
                dedented_lines = []
                for line in lines:
                    if line.strip():  # Non-empty line
                        # Remove indent_level spaces
                        if line.startswith(" " * indent_level):
                            dedented_lines.append(line[indent_level:])
                        else:
                            # Line has less indentation than expected
                            # Remove what we can
                            leading = line[:len(line) - len(line.lstrip())]
                            if len(leading) > 0:
                                dedented_lines.append(line[len(leading):])
                            else:
                                dedented_lines.append(line)
                    else:
                        # Empty line (just whitespace) - dedent it too
                        if line.startswith(" " * indent_level):
                            dedented_lines.append(line[indent_level:])
                        else:
                            # Line has less indentation than expected, remove what we can
                            leading = line[:len(line) - len(line.lstrip())]
                            if len(leading) > 0:
                                dedented_lines.append(line[len(leading):])
                            else:
                                dedented_lines.append(line)
                result[i] = "\n".join(dedented_lines)

    return tuple(result)


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


def _parse_separator(render_hints: str) -> str:
    """
    Parse the separator from render hints.

    Looks for "sep=<value>" in the render hints. Returns "\n" as default.

    Parameters
    ----------
    render_hints : str
        The render hints string (everything after first colon in format spec).

    Returns
    -------
    str
        The separator value, or "\n" if not specified.
    """
    if not render_hints:
        return "\n"

    # Look for "sep=<value>" in render hints
    for hint in render_hints.split(":"):
        if hint.startswith("sep="):
            return hint[4:]  # Extract everything after "sep="

    return "\n"


def _parse_render_hints(render_hints: str, key: str) -> dict[str, str]:
    """
    Parse render hints into a structured format.

    Extracts special hints like xml=<value> and header=<heading> (or just header).
    Leading and trailing whitespace is trimmed from hint specifications.

    Parameters
    ----------
    render_hints : str
        The render hints string (everything after first colon in format spec).
    key : str
        The interpolation key (used as default for header if no value specified).

    Returns
    -------
    dict[str, str]
        Dictionary with parsed hints. Possible keys: 'xml', 'header', 'sep'.
    """
    if not render_hints:
        return {}

    result = {}

    # Split on colon and process each hint
    for hint in render_hints.split(":"):
        hint = hint.strip()  # Trim leading/trailing whitespace

        if hint.startswith("xml="):
            # Extract XML tag name (no whitespace allowed in value)
            xml_value = hint[4:].strip()
            if " " in xml_value or "\t" in xml_value or "\n" in xml_value:
                raise ValueError(f"XML tag name cannot contain whitespace: {xml_value!r}")
            result["xml"] = xml_value

        elif hint.startswith("header="):
            # Extract header text (whitespace allowed in heading)
            header_value = hint[7:].strip()
            result["header"] = header_value

        elif hint == "header":
            # No value specified, use the key as heading
            result["header"] = key

        elif hint.startswith("sep="):
            # Extract separator value
            result["sep"] = hint[4:]

    return result


@dataclass(frozen=True, slots=True)
class TextChunk:
    """
    A chunk of text in the rendered output.

    Attributes
    ----------
    text : str
        The text content of this chunk.
    chunk_index : int
        Position of this chunk in the output sequence.
    """
    text: str
    chunk_index: int


@dataclass(frozen=True, slots=True)
class ImageChunk:
    """
    An image chunk in the rendered output.

    Attributes
    ----------
    image : Any
        The PIL Image object (typed as Any to avoid hard dependency on PIL).
    chunk_index : int
        Position of this chunk in the output sequence.
    """
    image: Any
    chunk_index: int


@dataclass(frozen=True, slots=True)
class SourceSpan:
    """
    Represents a span in the rendered output that maps back to a source element.

    Attributes
    ----------
    start : int
        Starting position (inclusive) in the rendered chunk.
        For text chunks: character offset. For image chunks: 0.
    end : int
        Ending position (exclusive) in the rendered chunk.
        For text chunks: character offset. For image chunks: 1 (whole image).
    key : Union[str, int]
        The key of the element: string for interpolations, int for static segments.
    path : tuple[Union[str, int], ...]
        Path from root to this element (sequence of keys).
    element_type : Literal["static", "interpolation", "image"]
        The type of element this span represents.
    chunk_index : int
        Index of the chunk this span refers to in the chunks list.
    element_id : str
        UUID of the source element (from Element.id or StructuredPrompt.id).
    """
    start: int
    end: int
    key: Union[str, int]
    path: tuple[Union[str, int], ...]
    element_type: Literal["static", "interpolation", "image"]
    chunk_index: int
    element_id: str


class IntermediateRepresentation:
    """
    Intermediate representation of a StructuredPrompt with multi-modal chunks and source mapping.

    This class serves as the bridge between structured prompts and their final output.
    It's ideal for:
    - Structured prompt optimization (removing parts when approaching context limits)
    - Debugging optimization strategies with full provenance
    - Multi-modal support (text and image chunks)
    - Token counting for specific portions of the prompt

    The name "IntermediateRepresentation" reflects that this is not necessarily the
    final output sent to an LLM, but rather a structured intermediate form that can
    be further processed, optimized, or transformed before final rendering.

    Attributes
    ----------
    chunks : list[TextChunk | ImageChunk]
        Ordered list of output chunks (text or image).
    source_map : list[SourceSpan]
        List of source spans mapping chunks and positions back to source elements.
    element_spans : dict[str, list[SourceSpan]]
        Reverse index: element_id → spans for bidirectional lookup.
    source_prompt : StructuredPrompt
        The StructuredPrompt that was rendered to produce this result.
    """

    def __init__(
        self,
        chunks: list[Union[TextChunk, ImageChunk]],
        source_map: list[SourceSpan],
        source_prompt: "StructuredPrompt"
    ):
        self._chunks = chunks
        self._source_map = source_map
        self._source_prompt = source_prompt

        # Build reverse index: element_id -> list of spans
        self._element_spans: dict[str, list[SourceSpan]] = {}
        for span in source_map:
            if span.element_id not in self._element_spans:
                self._element_spans[span.element_id] = []
            self._element_spans[span.element_id].append(span)

    @property
    def chunks(self) -> list[Union[TextChunk, ImageChunk]]:
        """Return the list of output chunks."""
        return self._chunks

    @property
    def text(self) -> str:
        """
        Return the rendered text (concatenates all text chunks).

        Raises
        ------
        ImageRenderError
            If any image chunks are present.
        """
        # Check for image chunks
        for chunk in self._chunks:
            if isinstance(chunk, ImageChunk):
                raise ImageRenderError()

        # Concatenate all text chunks
        return "".join(chunk.text for chunk in self._chunks if isinstance(chunk, TextChunk))

    @property
    def source_map(self) -> list[SourceSpan]:
        """Return the source map."""
        return self._source_map

    @property
    def element_spans(self) -> dict[str, list[SourceSpan]]:
        """Return the element ID to spans mapping (for source→output lookups)."""
        return self._element_spans

    @property
    def source_prompt(self) -> "StructuredPrompt":
        """Return the source StructuredPrompt that was rendered."""
        return self._source_prompt

    def get_span_at(self, position_or_chunk: int, position: Optional[int] = None) -> Optional[SourceSpan]:
        """
        Get the source span at a given position.

        This method supports two calling conventions:
        1. get_span_at(position) - searches in chunk 0 (backward compatible)
        2. get_span_at(chunk_index, position) - searches in specific chunk

        Parameters
        ----------
        position_or_chunk : int
            Either the position (if position is None) or chunk_index (if position is provided).
        position : int, optional
            Position within the chunk (for text chunks: character offset, for image chunks: should be 0).
            If None, position_or_chunk is treated as the position in chunk 0.

        Returns
        -------
        SourceSpan | None
            The span containing this position, or None if not in any span.
        """
        if position is None:
            # Backward compatible: get_span_at(position) searches chunk 0
            chunk_index = 0
            position = position_or_chunk
        else:
            # New API: get_span_at(chunk_index, position)
            chunk_index = position_or_chunk

        for span in self._source_map:
            if span.chunk_index == chunk_index and span.start <= position < span.end:
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

    def get_spans_for_element(self, element_id: str) -> list[SourceSpan]:
        """
        Get all source spans for a specific element by its ID.

        This enables source→output lookups: given an element, find all spans
        in the output that came from it.

        Parameters
        ----------
        element_id : str
            The UUID of the element (from Element.id or StructuredPrompt.id).

        Returns
        -------
        list[SourceSpan]
            List of all spans for this element (may be empty if not found).
        """
        return self._element_spans.get(element_id, [])

    def get_spans_for_prompt(self, prompt: "StructuredPrompt") -> list[SourceSpan]:
        """
        Get all source spans for a specific StructuredPrompt (aggregate query).

        This returns spans from all elements within the prompt, including
        nested prompts. Useful for token counting and optimization.

        Parameters
        ----------
        prompt : StructuredPrompt
            The StructuredPrompt to get spans for.

        Returns
        -------
        list[SourceSpan]
            List of all spans from this prompt and its nested prompts.
        """
        result = []
        # Get spans for all elements in this prompt
        for element in prompt.elements:
            result.extend(self.get_spans_for_element(element.id))
            # If this is a nested prompt, recursively get its spans
            if isinstance(element, StructuredInterpolation) and isinstance(element.value, StructuredPrompt):
                result.extend(self.get_spans_for_prompt(element.value))
            elif isinstance(element, ListInterpolation):
                for item in element.items:
                    result.extend(self.get_spans_for_prompt(item))
        return result

    def __str__(self) -> str:
        """Return the rendered text."""
        return self.text

    def __repr__(self) -> str:
        """Return a helpful debug representation."""
        return f"IntermediateRepresentation(chunks={len(self._chunks)}, spans={len(self._source_map)})"


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
    source_location : SourceLocation | None
        Source code location information for this element (if available).
    id : str
        Unique identifier for this element (UUID4 string).
    """

    key: Union[str, int]
    parent: Optional["StructuredPrompt"]
    index: int
    source_location: Optional[SourceLocation] = None
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


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


@dataclass(frozen=True, slots=True)
class StructuredInterpolation(Element):
    """
    Immutable record of one interpolation occurrence in a StructuredPrompt.

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
    value : str | StructuredPrompt
        The evaluated value (string or nested StructuredPrompt).
    """

    expression: str = ""
    conversion: Optional[str] = None
    format_spec: str = ""
    render_hints: str = ""
    value: Union[str, "StructuredPrompt"] = ""

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

    def __repr__(self) -> str:
        """Return a helpful debug representation."""
        return (
            f"ListInterpolation(key={self.key!r}, expression={self.expression!r}, "
            f"separator={self.separator!r}, items={len(self.items)}, index={self.index})"
        )


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

    def __repr__(self) -> str:
        """Return a helpful debug representation."""
        return (
            f"ImageInterpolation(key={self.key!r}, expression={self.expression!r}, "
            f"value=<PIL.Image>, index={self.index})"
        )


class StructuredPrompt(Mapping[str, Union[StructuredInterpolation, ListInterpolation, ImageInterpolation]]):
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

    def __init__(
        self,
        template: Template,
        *,
        allow_duplicate_keys: bool = False,
        _processed_strings: Optional[tuple[str, ...]] = None,
        _source_location: Optional[SourceLocation] = None
    ):
        self._template = template
        self._processed_strings = _processed_strings  # Dedented/trimmed strings if provided
        self._source_location = _source_location  # Source location for all elements in this prompt
        self._id = str(uuid.uuid4())  # Unique identifier for this StructuredPrompt
        # All elements (Static, StructuredInterpolation, ListInterpolation, ImageInterpolation)
        self._elements: list[Element] = []
        # Only interpolations
        self._interps: list[Union[StructuredInterpolation, ListInterpolation, ImageInterpolation]] = []
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
        interp_idx = 0   # Position within interpolations list

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
                elif isinstance(val, StructuredPrompt) or isinstance(val, str):
                    # Create StructuredInterpolation node
                    node = StructuredInterpolation(
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

    def __getitem__(self, key: str) -> Union[StructuredInterpolation, ListInterpolation, ImageInterpolation]:
        """
        Get the interpolation node for the given key.

        Parameters
        ----------
        key : str
            The key to look up (derived from format_spec or expression).

        Returns
        -------
        StructuredInterpolation | ListInterpolation | ImageInterpolation
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

    def get_all(self, key: str) -> list[Union[StructuredInterpolation, ListInterpolation, ImageInterpolation]]:
        """
        Get all interpolation nodes for a given key (for duplicate keys).

        Parameters
        ----------
        key : str
            The key to look up.

        Returns
        -------
        list[StructuredInterpolation | ListInterpolation | ImageInterpolation]
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
    def interpolations(self) -> tuple[Union[StructuredInterpolation, ListInterpolation, ImageInterpolation], ...]:
        """Return all interpolation nodes in order."""
        return tuple(self._interps)

    @property
    def elements(self) -> tuple[Element, ...]:
        """Return all elements (Static and StructuredInterpolation) in order."""
        return tuple(self._elements)

    # Rendering

    def render(
        self,
        _path: tuple[Union[str, int], ...] = (),
        max_header_level: int = 4,
        _header_level: int = 1
    ) -> IntermediateRepresentation:
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
        max_header_level : int, optional
            Maximum header level for markdown headers (default: 4).
        _header_level : int
            Internal parameter for tracking current header nesting level.

        Returns
        -------
        IntermediateRepresentation
            Object containing the rendered text and source map.

        Raises
        ------
        ImageRenderError
            If the prompt contains any image interpolations.
        """
        # Check for images in interpolations (cannot render to text-only)
        has_images = any(isinstance(interp, ImageInterpolation) for interp in self._interps)
        if has_images:
            raise ImageRenderError()

        # For now, render everything to a single text chunk
        # TODO: Support multiple chunks for multi-modal output
        out_parts: list[str] = []
        source_map: list[SourceSpan] = []
        current_pos = 0
        chunk_index = 0  # All spans go in chunk 0 for text-only rendering

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
                        element_type="static",
                        chunk_index=chunk_index,
                        element_id=element.id
                    ))

            elif isinstance(element, ListInterpolation):
                # Render list interpolation element
                node = element

                # Parse render hints
                hints = _parse_render_hints(node.render_hints, node.key)

                # Determine next header level if header hint is present
                next_header_level = _header_level
                if "header" in hints:
                    next_header_level = _header_level + 1

                # Check if the preceding static has trailing whitespace on the same line
                # This will be used as base indentation for all list items after the first
                base_indent = ""
                if out_parts:
                    last_part = out_parts[-1]
                    if last_part and '\n' in last_part:
                        # Get text after last newline
                        lines = last_part.split('\n')
                        last_line = lines[-1]
                        # If it's all whitespace, it's the base indent for list items
                        if last_line and last_line.strip() == "":
                            base_indent = last_line

                # Render each item and join with separator + base indent
                rendered_parts = []
                for item in node.items:
                    item_rendered = item.render(
                        _path=_path + (node.key,),
                        max_header_level=max_header_level,
                        _header_level=next_header_level
                    )
                    rendered_parts.append(item_rendered.text)
                    # Add nested source spans with offset
                    # Account for separator and base_indent between items
                    if len(rendered_parts) == 1:
                        current_offset = span_start
                    else:
                        # Previous items + their separators and indents
                        prev_content_len = sum(len(p) for p in rendered_parts[:-1])
                        prev_seps_len = (len(rendered_parts) - 2) * (len(node.separator) + len(base_indent))
                        sep_and_indent_len = len(node.separator) + len(base_indent)
                        current_offset = span_start + prev_content_len + prev_seps_len + sep_and_indent_len

                    for nested_span in item_rendered.source_map:
                        source_map.append(SourceSpan(
                            start=current_offset + nested_span.start,
                            end=current_offset + nested_span.end,
                            key=nested_span.key,
                            path=nested_span.path,
                            element_type=nested_span.element_type,
                            chunk_index=chunk_index,
                            element_id=nested_span.element_id
                        ))

                # Join with separator, adding base indent after each separator (except before first item)
                if base_indent and len(rendered_parts) > 1:
                    # First item has no prefix, subsequent items get separator + base_indent
                    rendered_text = rendered_parts[0]
                    for part in rendered_parts[1:]:
                        rendered_text += node.separator + base_indent + part
                else:
                    rendered_text = node.separator.join(rendered_parts)

                # Apply render hints (header first, then xml wrapper) to the entire list
                prefix_len = 0  # Track total prefix length for span adjustment

                if "xml" in hints:
                    # Wrap with XML tags (inner wrapper)
                    xml_tag = hints["xml"]
                    xml_wrapper_start = f"<{xml_tag}>\n"
                    xml_wrapper_end = f"\n</{xml_tag}>"
                    rendered_text = xml_wrapper_start + rendered_text + xml_wrapper_end
                    prefix_len += len(xml_wrapper_start)

                if "header" in hints:
                    # Prepend markdown header (outer wrapper)
                    level = min(_header_level, max_header_level)
                    header_prefix = "#" * level + " " + hints["header"] + "\n"
                    rendered_text = header_prefix + rendered_text
                    prefix_len += len(header_prefix)

                # Adjust span start for all added content
                span_start += prefix_len

                # Update position
                current_pos += len(rendered_text)
                out_parts.append(rendered_text)

            elif isinstance(element, StructuredInterpolation):
                # Render interpolation element
                node = element

                # Parse render hints
                hints = _parse_render_hints(node.render_hints, node.key)

                # Determine if we need to increment header level for nested rendering
                next_header_level = _header_level
                if "header" in hints:
                    next_header_level = _header_level + 1

                # Get value (render recursively if nested)
                if isinstance(node.value, StructuredPrompt):
                    nested_rendered = node.value.render(
                        _path=_path + (node.key,),
                        max_header_level=max_header_level,
                        _header_level=next_header_level
                    )
                    rendered_text = nested_rendered.text
                    # Add nested source spans with updated paths
                    for nested_span in nested_rendered.source_map:
                        source_map.append(SourceSpan(
                            start=span_start + nested_span.start,
                            end=span_start + nested_span.end,
                            key=nested_span.key,
                            path=nested_span.path,
                            element_type=nested_span.element_type,
                            chunk_index=chunk_index,
                            element_id=nested_span.element_id
                        ))
                else:
                    rendered_text = node.value
                    # Apply conversion if present
                    if node.conversion:
                        conv: Literal["r", "s", "a"] = node.conversion  # type: ignore
                        rendered_text = convert(rendered_text, conv)

                # Apply render hints (header first, then xml wrapper)
                prefix_len = 0  # Track total prefix length for span adjustment

                if "xml" in hints:
                    # Wrap with XML tags (inner wrapper)
                    xml_tag = hints["xml"]
                    xml_wrapper_start = f"<{xml_tag}>\n"
                    xml_wrapper_end = f"\n</{xml_tag}>"
                    rendered_text = xml_wrapper_start + rendered_text + xml_wrapper_end
                    prefix_len += len(xml_wrapper_start)

                if "header" in hints:
                    # Prepend markdown header (outer wrapper)
                    level = min(_header_level, max_header_level)
                    header_prefix = "#" * level + " " + hints["header"] + "\n"
                    rendered_text = header_prefix + rendered_text
                    prefix_len += len(header_prefix)

                # Adjust span start for all added content
                span_start += prefix_len

                # Add span for this interpolation
                current_pos += len(rendered_text)
                if not isinstance(node.value, StructuredPrompt):
                    # Only add direct span if not nested (nested spans are already added above)
                    source_map.append(SourceSpan(
                        start=span_start,
                        end=current_pos,
                        key=node.key,
                        path=_path,
                        element_type="interpolation",
                        chunk_index=chunk_index,
                        element_id=element.id
                    ))

                out_parts.append(rendered_text)

        # Create a single text chunk with all the rendered text
        text = "".join(out_parts)
        chunks: list[Union[TextChunk, ImageChunk]] = [TextChunk(text=text, chunk_index=chunk_index)]

        return IntermediateRepresentation(chunks, source_map, self)

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
            if isinstance(node, ListInterpolation):
                result[node.key] = [item.to_values() for item in node.items]
            elif isinstance(node, StructuredInterpolation):
                if isinstance(node.value, StructuredPrompt):
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
            (list of dicts with key, expression, conversion, format_spec, render_hints, value info,
            and source_location if available).
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

            # Add source location if available
            if node.source_location is not None and node.source_location.is_available:
                node_dict["source_location"] = {
                    "filename": node.source_location.filename,
                    "filepath": node.source_location.filepath,
                    "line": node.source_location.line,
                }

            if isinstance(node, ListInterpolation):
                node_dict["value"] = [item.to_provenance() for item in node.items]
            elif isinstance(node, StructuredInterpolation):
                if isinstance(node.value, StructuredPrompt):
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


def prompt(
    template: Template,
    /,
    *,
    dedent: bool = False,
    trim_leading: bool = True,
    trim_empty_leading: bool = True,
    trim_trailing: bool = True,
    capture_source_location: bool = True,
    **opts
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
            template,
            _processed_strings=processed_strings,
            _source_location=source_location,
            **opts
        )

    return StructuredPrompt(template, _source_location=source_location, **opts)


def dedent(
    template: Template,
    /,
    *,
    trim_leading: bool = True,
    trim_empty_leading: bool = True,
    trim_trailing: bool = True,
    **opts
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
        **opts
    )
