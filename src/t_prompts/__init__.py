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

__version__ = "0.7.3"
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
