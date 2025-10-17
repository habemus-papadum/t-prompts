"""Intermediate representation for rendered structured prompts."""

import uuid
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Optional, Union

if TYPE_CHECKING:
    from .element import Element
    from .structured_prompt import StructuredPrompt
    from .widgets.config import WidgetConfig
    from .widgets.widget import Widget


@dataclass(frozen=True, slots=True)
class TextChunk:
    """
    A chunk of text in the rendered output.

    Each chunk maps to exactly one source element.

    Attributes
    ----------
    text : str
        The text content of this chunk.
    element_id : str
        UUID of the source element that produced this chunk.
    id : str
        Unique identifier for this chunk (UUID4 string).
    metadata : dict[str, Any]
        Metadata dictionary for storing analysis results and other information.
    """

    text: str
    element_id: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    metadata: dict[str, Any] = field(default_factory=dict)

    def toJSON(self) -> dict[str, Any]:
        """
        Convert TextChunk to JSON-serializable dictionary.

        Returns
        -------
        dict[str, Any]
            Dictionary with type, text, element_id, id, metadata.
        """
        return {
            "type": "TextChunk",
            "text": self.text,
            "element_id": self.element_id,
            "id": self.id,
            "metadata": self.metadata,
        }


@dataclass(frozen=True, slots=True)
class ImageChunk:
    """
    An image chunk in the rendered output.

    Each chunk maps to exactly one source element.

    Attributes
    ----------
    image : Any
        The PIL Image object (typed as Any to avoid hard dependency on PIL).
    element_id : str
        UUID of the source element that produced this chunk.
    id : str
        Unique identifier for this chunk (UUID4 string).
    metadata : dict[str, Any]
        Metadata dictionary for storing analysis results and other information.
    """

    image: Any
    element_id: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def text(self) -> str:
        """
        Return a text placeholder for this image.

        Returns a bracketed description with format, dimensions, and mode.
        Example: [Image: PNG 1024x768 RGB]

        Returns
        -------
        str
            Text placeholder describing the image.
        """
        try:
            width, height = self.image.size
            mode = self.image.mode
            fmt = self.image.format or "Unknown"
            return f"[Image: {fmt} {width}x{height} {mode}]"
        except (AttributeError, Exception):
            return "[Image]"

    def toJSON(self) -> dict[str, Any]:
        """
        Convert ImageChunk to JSON-serializable dictionary.

        The image is serialized to base64 with metadata.

        Returns
        -------
        dict[str, Any]
            Dictionary with type, image (as base64 dict), element_id, id, metadata.
        """
        # Import here to avoid circular dependency and optional PIL dependency
        from .element import _serialize_image

        return {
            "type": "ImageChunk",
            "image": _serialize_image(self.image),
            "element_id": self.element_id,
            "id": self.id,
            "metadata": self.metadata,
        }


@dataclass(frozen=True, slots=True)
class RenderContext:
    """
    Context information passed to elements during rendering.

    Attributes
    ----------
    path : tuple[Union[str, int], ...]
        Current path from root to this element (sequence of keys).
    header_level : int
        Current nesting level for markdown headers.
    max_header_level : int
        Maximum allowed header level (headers deeper than this are capped).
    """

    path: tuple[Union[str, int], ...]
    header_level: int
    max_header_level: int


class IntermediateRepresentation:
    """
    Lightweight intermediate representation with multi-modal chunks.

    This class is a data container for rendered output with chunk-based operations.
    Each chunk contains an element_id that maps it directly to its source element.
    Query methods and indexes are provided by CompiledIR (created via compile()).

    Operations:
    - empty() - create empty IR
    - from_text(text, element_id) - create IR from text string
    - from_image(image, element_id) - create IR from PIL Image
    - wrap(prefix, suffix, wrapper_element_id) - wrap with additional text
    - merge(irs, separator, separator_element_id) - concatenate multiple IRs

    Attributes
    ----------
    chunks : list[TextChunk | ImageChunk]
        Ordered list of output chunks (text or image).
        Each chunk has an element_id that maps it to its source element.
    source_prompt : StructuredPrompt | None
        The source prompt (None for intermediate IRs).
    id : str
        Unique identifier for this IR.
    metadata : dict[str, Any]
        Metadata dictionary for storing analysis results and other information.
    """

    def __init__(
        self,
        chunks: list[Union[TextChunk, ImageChunk]],
        source_prompt: Optional["StructuredPrompt"] = None,
        metadata: Optional[dict[str, Any]] = None,
    ):
        """
        Create an IntermediateRepresentation from chunks.

        This is a minimal constructor that just stores data. Rendering logic
        lives in StructuredPrompt.ir() and Element.ir() methods.

        Parameters
        ----------
        chunks : list[TextChunk | ImageChunk]
            The output chunks (text or image).
            Each chunk must have an element_id.
        source_prompt : StructuredPrompt | None, optional
            The source prompt that produced this IR (None for intermediate IRs).
        metadata : dict[str, Any] | None, optional
            Metadata dictionary for storing analysis results. If None, creates empty dict.
        """
        self._id = str(uuid.uuid4())
        self._chunks = chunks
        self._source_prompt = source_prompt
        self._metadata = metadata if metadata is not None else {}

    @classmethod
    def empty(cls) -> "IntermediateRepresentation":
        """
        Create an empty IntermediateRepresentation.

        Returns
        -------
        IntermediateRepresentation
            Empty IR with no chunks, no source prompt.
        """
        return cls(chunks=[], source_prompt=None)

    @classmethod
    def from_text(cls, text: str, element_id: str) -> "IntermediateRepresentation":
        """
        Create an IR from a single text string.

        Parameters
        ----------
        text : str
            The text content.
        element_id : str
            UUID of the element that produced this text.

        Returns
        -------
        IntermediateRepresentation
            IR with a single TextChunk.
        """
        chunk = TextChunk(text=text, element_id=element_id)
        return cls(chunks=[chunk], source_prompt=None)

    @classmethod
    def from_image(cls, image: Any, element_id: str) -> "IntermediateRepresentation":
        """
        Create an IR from a single image.

        Parameters
        ----------
        image : Any
            PIL Image object.
        element_id : str
            UUID of the element that produced this image.

        Returns
        -------
        IntermediateRepresentation
            IR with a single ImageChunk.
        """
        chunk = ImageChunk(image=image, element_id=element_id)
        return cls(chunks=[chunk], source_prompt=None)

    def wrap(self, prefix: str, suffix: str, wrapper_element_id: str) -> "IntermediateRepresentation":
        """
        Wrap this IR by prepending/appending text chunks.

        Creates new chunks for prefix/suffix rather than modifying existing chunks.
        This maintains the immutability of chunks and simplifies source mapping.

        Parameters
        ----------
        prefix : str
            Text to prepend (creates new chunk if non-empty).
        suffix : str
            Text to append (creates new chunk if non-empty).
        wrapper_element_id : str
            Element ID for the prefix/suffix chunks (e.g., element with render hints).

        Returns
        -------
        IntermediateRepresentation
            New IR with wrapper chunks added.
        """
        if not self._chunks:
            # Empty IR: just create a text chunk with prefix+suffix
            if prefix or suffix:
                return IntermediateRepresentation.from_text(prefix + suffix, wrapper_element_id)
            return self

        new_chunks = list(self._chunks)

        # Always insert new chunks for prefix/suffix (never modify existing)
        if prefix:
            prefix_chunk = TextChunk(text=prefix, element_id=wrapper_element_id)
            new_chunks.insert(0, prefix_chunk)

        if suffix:
            suffix_chunk = TextChunk(text=suffix, element_id=wrapper_element_id)
            new_chunks.append(suffix_chunk)

        return IntermediateRepresentation(
            chunks=new_chunks,
            source_prompt=self._source_prompt,
            metadata=self._metadata,
        )

    @classmethod
    def merge(
        cls,
        irs: list["IntermediateRepresentation"],
        separator: str = "",
        separator_element_id: str = "",
    ) -> "IntermediateRepresentation":
        """
        Merge multiple IRs into a single IR.

        Reuses existing chunks - no recreation needed!
        Inserts separator as TextChunk between IRs (if non-empty).

        Parameters
        ----------
        irs : list[IntermediateRepresentation]
            List of IRs to merge.
        separator : str, optional
            Separator to insert between IRs (default: "").
        separator_element_id : str, optional
            Element ID for separator chunks (e.g., ListInterpolation that wants this separator).

        Returns
        -------
        IntermediateRepresentation
            Merged IR with concatenated chunks.
        """
        if not irs:
            return cls.empty()

        if len(irs) == 1:
            return irs[0]

        all_chunks: list[Union[TextChunk, ImageChunk]] = []

        for i, ir in enumerate(irs):
            # Add separator before all IRs except the first
            if i > 0 and separator:
                sep_chunk = TextChunk(text=separator, element_id=separator_element_id)
                all_chunks.append(sep_chunk)

            # Just append existing chunks - no recreation!
            all_chunks.extend(ir.chunks)

        return cls(chunks=all_chunks, source_prompt=None)

    @property
    def chunks(self) -> list[Union[TextChunk, ImageChunk]]:
        """Return the list of output chunks."""
        return self._chunks

    @property
    def source_prompt(self) -> Optional["StructuredPrompt"]:
        """Return the source StructuredPrompt (None for intermediate IRs)."""
        return self._source_prompt

    @property
    def id(self) -> str:
        """Return the unique identifier for this IntermediateRepresentation."""
        return self._id

    @property
    def metadata(self) -> dict[str, Any]:
        """Return the metadata dictionary for this IntermediateRepresentation."""
        return self._metadata

    @property
    def text(self) -> str:
        """
        Return the text representation of this IR.

        Concatenates the text of all chunks. For TextChunks, uses the text field.
        For ImageChunks, uses the placeholder text from ImageChunk.text property.

        Returns
        -------
        str
            Concatenated text from all chunks.
        """
        return "".join(chunk.text for chunk in self._chunks)

    def compile(self) -> "CompiledIR":
        """
        Compile this IR to build efficient indexes for queries.

        This is an expensive operation - only call when you need query methods.

        Returns
        -------
        CompiledIR
            Compiled IR with indexes for fast lookups.
        """
        return CompiledIR(self)

    def toJSON(self) -> dict[str, Any]:
        """
        Convert IntermediateRepresentation to JSON-serializable dictionary.

        Chunks are serialized fully. The source_prompt is serialized as just its ID
        since the full StructuredPrompt object will be stored elsewhere.

        Returns
        -------
        dict[str, Any]
            Dictionary with chunks (as list of chunk JSON dicts), source_prompt_id, id, metadata.
        """
        return {
            "chunks": [chunk.toJSON() for chunk in self._chunks],
            "source_prompt_id": self._source_prompt.id if self._source_prompt else None,
            "id": self._id,
            "metadata": self._metadata,
        }

    def __repr__(self) -> str:
        """Return a helpful debug representation."""
        return f"IntermediateRepresentation(chunks={len(self._chunks)})"

    def widget(self, config: Optional["WidgetConfig"] = None) -> "Widget":
        """
        Create a Widget for Jupyter notebook display.

        This compiles the IR first, then delegates to CompiledIR.widget().

        Parameters
        ----------
        config : WidgetConfig | None, optional
            Widget configuration. If None, uses the package default config.

        Returns
        -------
        Widget
            Widget instance with rendered HTML.

        Examples
        --------
        >>> p = prompt(t"Hello {name}")
        >>> ir = p.ir()
        >>> widget = ir.widget()
        >>> # Or with custom config
        >>> from t_prompts import WidgetConfig
        >>> widget = ir.widget(WidgetConfig(wrapping=False))
        """
        compiled = self.compile()
        return compiled.widget(config)

    def _repr_html_(self) -> str:
        """
        Return HTML representation for Jupyter notebook display.

        This method is automatically called by Jupyter/IPython when displaying
        an IntermediateRepresentation in a notebook cell.

        Returns
        -------
        str
            HTML string with widget visualization.
        """
        return self.widget()._repr_html_()


class CompiledIR:
    """
    Compiled IntermediateRepresentation with efficient subtree query support.

    Created by calling IR.compile(). Provides optimized queries:
    - get_chunks_for_subtree(element_id) → chunks in sequence for element and descendants

    The subtree index is built bottom-up by composing indices from child elements,
    enabling efficient O(1) queries after O(n) construction.

    Attributes
    ----------
    ir : IntermediateRepresentation
        The original IntermediateRepresentation.
    """

    def __init__(self, ir: IntermediateRepresentation):
        """
        Compile an IR by building subtree indexes.

        Traverses the element tree bottom-up to build efficient chunk indices
        for each element's subtree (element + all descendants).

        Parameters
        ----------
        ir : IntermediateRepresentation
            The IR to compile. Must have a source_prompt.

        Raises
        ------
        ValueError
            If the IR does not have a source_prompt.
        """
        # Check that IR has a source_prompt
        if ir.source_prompt is None:
            raise ValueError(
                "Cannot compile an IR without a source_prompt. "
                "Only IRs created from StructuredPrompt.ir() can be compiled."
            )

        # Keep reference to original IR
        self._ir = ir
        self._chunks = ir.chunks

        # Build element_id → chunk indices map (temporary for construction)
        chunk_indices_by_element: dict[str, list[int]] = {}
        for i, chunk in enumerate(self._chunks):
            if chunk.element_id not in chunk_indices_by_element:
                chunk_indices_by_element[chunk.element_id] = []
            chunk_indices_by_element[chunk.element_id].append(i)

        # Build subtree index: element_id → chunk indices (including descendants)
        self._subtree_chunks: dict[str, list[int]] = {}

        # Collect all elements into a map
        self._elements: dict[str, "Element"] = {}
        self._collect_elements(self._ir.source_prompt)

        # Build subtree indices bottom-up
        self._build_subtree_index(self._ir.source_prompt, chunk_indices_by_element)

    def _collect_elements(self, prompt: "StructuredPrompt") -> None:
        """
        Recursively collect all elements from the prompt tree.

        Parameters
        ----------
        prompt : StructuredPrompt
            The prompt to collect elements from.
        """
        for elem in prompt.children:
            self._elements[elem.id] = elem

            # Import here to avoid circular dependency
            from .element import ListInterpolation
            from .structured_prompt import StructuredPrompt

            if isinstance(elem, StructuredPrompt):
                # StructuredPrompt is now stored directly as a child element
                self._collect_elements(elem)
            elif isinstance(elem, ListInterpolation):
                # Items are now stored directly as StructuredPrompts (no wrappers)
                for item in elem.item_elements:
                    self._elements[item.id] = item
                    self._collect_elements(item)

    def _build_subtree_index(
        self,
        prompt: "StructuredPrompt",
        chunk_indices_by_element: dict[str, list[int]],
    ) -> None:
        """
        Build subtree chunk indices for prompt and all elements.

        Parameters
        ----------
        prompt : StructuredPrompt
            The prompt to build indices for.
        chunk_indices_by_element : dict[str, list[int]]
            Map of element_id to direct chunk indices.
        """
        all_indices = []

        for elem in prompt.children:
            elem_indices = self._build_element_subtree(elem, chunk_indices_by_element)
            all_indices.extend(elem_indices)

        # Store for the prompt itself
        self._subtree_chunks[prompt.id] = all_indices

    def _build_element_subtree(
        self,
        elem: "Element",
        chunk_indices_by_element: dict[str, list[int]],
    ) -> list[int]:
        """
        Recursively build and store subtree indices for an element.

        Composes indices bottom-up: element's direct chunks + descendant chunks.

        Parameters
        ----------
        elem : Element
            The element to build indices for.
        chunk_indices_by_element : dict[str, list[int]]
            Map of element_id to direct chunk indices.

        Returns
        -------
        list[int]
            Chunk indices for this element's entire subtree.
        """
        # Import here to avoid circular dependency
        from .element import ListInterpolation
        from .structured_prompt import StructuredPrompt

        # Handle ListInterpolation specially - interleave separators between items
        if isinstance(elem, ListInterpolation):
            # Get separator chunks (these have the list element's ID)
            separator_indices = list(chunk_indices_by_element.get(elem.id, []))

            # Assert: number of separators should be one less than number of items
            assert len(separator_indices) == len(elem.item_elements) - 1, (
                f"ListInterpolation should have {len(elem.item_elements) - 1} separators, "
                f"but found {len(separator_indices)}"
            )

            # Interleave: item[i] chunks, then separator[i], repeat
            # Pattern: [item0, sep0, item1, sep1, ..., itemN] (no separator after last)
            indices = []
            for i, item in enumerate(elem.item_elements):
                # Add all chunks from this item's subtree
                item_indices = self._build_element_subtree(item, chunk_indices_by_element)
                indices.extend(item_indices)

                # Add separator after this item (except for last item)
                if i < len(separator_indices):
                    indices.append(separator_indices[i])
        else:
            # For all other element types, start with element's direct chunks
            indices = list(chunk_indices_by_element.get(elem.id, []))

            # Add chunks from descendants
            if isinstance(elem, StructuredPrompt):
                # StructuredPrompt stored directly - recurse into its children
                nested_indices = []
                for child_elem in elem.children:
                    nested_indices.extend(self._build_element_subtree(child_elem, chunk_indices_by_element))
                indices.extend(nested_indices)

                # IMPORTANT: Sort indices to preserve chunk order from IR
                # When a StructuredPrompt has render hints (xml, header), the wrapper chunks
                # are at the beginning and end of the IR, but we collect them separately.
                # Sorting ensures: [wrapper_open, ...content..., wrapper_close]
                indices.sort()

        # Store for this element
        self._subtree_chunks[elem.id] = indices
        return indices

    @property
    def ir(self) -> IntermediateRepresentation:
        """Return the original IntermediateRepresentation."""
        return self._ir

    def get_chunks_for_subtree(self, element_id: str) -> list[Union[TextChunk, ImageChunk]]:
        """
        Get all chunks for an element and its descendants, in sequence.

        This is the primary query interface for CompiledIR. It returns all chunks
        that the element or any of its descendants are responsible for, in the
        order they appear in the rendered output.

        Parameters
        ----------
        element_id : str
            UUID of the element or prompt.

        Returns
        -------
        list[TextChunk | ImageChunk]
            All chunks from this element's subtree, in output sequence order.
            Returns empty list if element_id not found.

        Examples
        --------
        >>> p = prompt(t"Hello {name:n}!")
        >>> compiled = p.ir().compile()
        >>> # Get all chunks for the entire prompt
        >>> compiled.get_chunks_for_subtree(p.id)
        [TextChunk('Hello '), TextChunk('world'), TextChunk('!')]
        >>> # Get chunks just for the interpolation element
        >>> compiled.get_chunks_for_subtree(p.children[1].id)
        [TextChunk('world')]
        """
        indices = self._subtree_chunks.get(element_id, [])
        return [self._chunks[i] for i in indices]

    def toJSON(self) -> dict[str, Any]:
        """
        Convert CompiledIR to JSON-serializable dictionary.

        The original IR is referenced by ID. The subtree_chunks mapping is serialized
        with chunk IDs instead of indices for easier cross-referencing.

        Returns
        -------
        dict[str, Any]
            Dictionary with ir_id, subtree_map (element_id -> list of chunk_ids),
            and num_elements.
        """
        # Convert subtree_chunks from indices to chunk IDs
        subtree_map = {}
        for element_id, indices in self._subtree_chunks.items():
            subtree_map[element_id] = [self._chunks[i].id for i in indices]

        return {
            "ir_id": self._ir.id,
            "subtree_map": subtree_map,
            "num_elements": len(self._subtree_chunks),
        }

    def __repr__(self) -> str:
        """Return a helpful debug representation."""
        return f"CompiledIR(chunks={len(self._chunks)}, elements={len(self._subtree_chunks)})"

    def widget_data(self, config: Optional["WidgetConfig"] = None) -> dict[str, Any]:
        """
        Get the widget data dictionary (JSON) without rendering HTML.

        This is useful for testing or when you need the raw data that would
        be embedded in the widget HTML.

        Parameters
        ----------
        config : WidgetConfig | None, optional
            Widget configuration. If None, uses the package default config.

        Returns
        -------
        dict[str, Any]
            Dictionary with compiled_ir, ir, source_prompt, and config.

        Examples
        --------
        >>> p = prompt(t"Hello {name}")
        >>> compiled = p.ir().compile()
        >>> data = compiled.widget_data()
        >>> data.keys()
        dict_keys(['compiled_ir', 'ir', 'source_prompt', 'config'])
        """
        from .widgets import get_default_widget_config

        # Use provided config or fall back to package default
        if config is None:
            config = get_default_widget_config()

        # Create combined JSON data with compiled IR, IR, source prompt, and config
        return {
            "compiled_ir": self.toJSON(),
            "ir": self._ir.toJSON(),
            "source_prompt": self._ir.source_prompt.toJSON(),
            "config": {
                "wrapping": config.wrapping,
                "sourcePrefix": config.sourcePrefix,
            },
        }

    def widget(self, config: Optional["WidgetConfig"] = None) -> "Widget":
        """
        Create a Widget for Jupyter notebook display.

        Parameters
        ----------
        config : WidgetConfig | None, optional
            Widget configuration. If None, uses the package default config.

        Returns
        -------
        Widget
            Widget instance with rendered HTML.

        Examples
        --------
        >>> p = prompt(t"Hello {name}")
        >>> compiled = p.ir().compile()
        >>> widget = compiled.widget()
        >>> # Or with custom config
        >>> from t_prompts import WidgetConfig
        >>> widget = compiled.widget(WidgetConfig(wrapping=False))
        """
        from .widgets import Widget, _render_widget_html

        # Get the widget data
        data = self.widget_data(config)

        # Render to HTML
        html = _render_widget_html(data)
        return Widget(html)

    def _repr_html_(self) -> str:
        """
        Return HTML representation for Jupyter notebook display.

        This method is automatically called by Jupyter/IPython when displaying
        a CompiledIR in a notebook cell.

        Returns
        -------
        str
            HTML string with widget visualization.
        """
        return self.widget()._repr_html_()
