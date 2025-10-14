"""Structured prompts using template strings"""

from .core import (
    Element,
    IntermediateRepresentation,
    ListInterpolation,
    SourceSpan,
    Static,
    StructuredInterpolation,
    StructuredPrompt,
    dedent,
    prompt,
)
from .exceptions import (
    DedentError,
    DuplicateKeyError,
    EmptyExpressionError,
    MissingKeyError,
    NotANestedPromptError,
    StructuredPromptsError,
    UnsupportedValueTypeError,
)

__version__ = "0.4.0-alpha"
__all__ = [
    "StructuredPrompt",
    "StructuredInterpolation",
    "ListInterpolation",
    "Element",
    "Static",
    "IntermediateRepresentation",
    "SourceSpan",
    "prompt",
    "dedent",
    "DedentError",
    "EmptyExpressionError",
    "DuplicateKeyError",
    "MissingKeyError",
    "NotANestedPromptError",
    "StructuredPromptsError",
    "UnsupportedValueTypeError",
    "__version__",
]
