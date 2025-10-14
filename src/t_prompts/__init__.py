"""Structured prompts using template strings"""

from .core import RenderedPrompt, SourceSpan, StructuredInterpolation, StructuredPrompt, prompt
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
