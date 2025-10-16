"""Structured prompts using template strings"""

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

__version__ = "0.11.0"
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
