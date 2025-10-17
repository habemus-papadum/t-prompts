"""Structured prompts using template strings"""

from .diff import (
    ChunkDelta,
    DiffStats,
    ElementRenderDelta,
    Movement,
    NodeChange,
    NodeDelta,
    PromptDiff,
    RenderDiff,
    SequenceDiff,
    SequenceDiffOp,
    diff_rendered_prompts,
    diff_structured_prompts,
)
from .element import (
    Element,
    ImageInterpolation,
    ListInterpolation,
    Static,
    TextInterpolation,
)
from .exceptions import (
    DedentError,
    DuplicateKeyError,
    EmptyExpressionError,
    ImageRenderError,
    MissingKeyError,
    NotANestedPromptError,
    PromptReuseError,
    StructuredPromptsError,
    UnsupportedValueTypeError,
)
from .ir import ImageChunk, IntermediateRepresentation, TextChunk
from .parsing import (
    parse_format_spec,
    parse_render_hints,
    parse_separator,
)
from .source_location import SourceLocation
from .structured_prompt import StructuredPrompt, dedent, prompt
from .text import process_dedent
from .widgets import Widget, WidgetConfig, get_default_widget_config, set_default_widget_config

__version__ = "0.14.0-alpha"
__all__ = [
    "StructuredPrompt",
    "TextInterpolation",
    "ListInterpolation",
    "ImageInterpolation",
    "Element",
    "Static",
    "IntermediateRepresentation",
    "SourceLocation",
    "TextChunk",
    "ImageChunk",
    "PromptDiff",
    "RenderDiff",
    "NodeDelta",
    "NodeChange",
    "Movement",
    "SequenceDiff",
    "SequenceDiffOp",
    "DiffStats",
    "ChunkDelta",
    "ElementRenderDelta",
    "diff_structured_prompts",
    "diff_rendered_prompts",
    "Widget",
    "WidgetConfig",
    "prompt",
    "dedent",
    "get_default_widget_config",
    "set_default_widget_config",
    "parse_format_spec",
    "parse_render_hints",
    "parse_separator",
    "process_dedent",
    "DedentError",
    "EmptyExpressionError",
    "DuplicateKeyError",
    "ImageRenderError",
    "MissingKeyError",
    "NotANestedPromptError",
    "PromptReuseError",
    "StructuredPromptsError",
    "UnsupportedValueTypeError",
    "__version__",
]
