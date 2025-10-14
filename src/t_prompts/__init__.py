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
from .ui import render_ir_to_html

__version__ = "0.8.0-alpha"
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
    "render_ir_to_html",
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
