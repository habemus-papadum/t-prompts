"""Structured prompts using template strings"""

from .element import (
    Element,
    ImageInterpolation,
    ListInterpolation,
    NestedPromptInterpolation,
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

__version__ = "0.10.0-alpha"
__all__ = [
    "StructuredPrompt",
    "TextInterpolation",
    "NestedPromptInterpolation",
    "ListInterpolation",
    "ImageInterpolation",
    "Element",
    "Static",
    "IntermediateRepresentation",
    "SourceLocation",
    "TextChunk",
    "ImageChunk",
    "prompt",
    "dedent",
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
