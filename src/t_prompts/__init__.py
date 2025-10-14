"""Structured prompts using template strings"""

from .core import (
    Element,
    ImageChunk,
    ImageInterpolation,
    IntermediateRepresentation,
    ListInterpolation,
    SourceLocation,
    SourceSpan,
    Static,
    StructuredInterpolation,
    StructuredPrompt,
    TextChunk,
    dedent,
    prompt,
)
from .exceptions import (
    DedentError,
    DuplicateKeyError,
    EmptyExpressionError,
    ImageRenderError,
    MissingKeyError,
    NotANestedPromptError,
    StructuredPromptsError,
    UnsupportedValueTypeError,
)
from .parsing import (
    parse_format_spec,
    parse_render_hints,
    parse_separator,
)
from .text import process_dedent

__version__ = "0.9.0-alpha"
__all__ = [
    "StructuredPrompt",
    "StructuredInterpolation",
    "ListInterpolation",
    "ImageInterpolation",
    "Element",
    "Static",
    "IntermediateRepresentation",
    "SourceSpan",
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
    "StructuredPromptsError",
    "UnsupportedValueTypeError",
    "__version__",
]
