"""Structured prompts using template strings"""

from .core import Element, RenderedPrompt, SourceSpan, Static, StructuredInterpolation, StructuredPrompt, prompt
from .exceptions import (
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
    "Element",
    "Static",
    "RenderedPrompt",
    "SourceSpan",
    "prompt",
    "EmptyExpressionError",
    "DuplicateKeyError",
    "MissingKeyError",
    "NotANestedPromptError",
    "StructuredPromptsError",
    "UnsupportedValueTypeError",
    "__version__",
]
