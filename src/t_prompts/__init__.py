"""Structured prompts using template strings"""

from .diff import (
    RenderedPromptDiff,
    StructuredPromptDiff,
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
from .widgets import (
    Widget,
    WidgetConfig,
    get_default_widget_config,
    js_prelude,
    set_default_widget_config,
    setup_notebook,
)

__version__ = "0.18.1"
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
    "js_prelude",
    "setup_notebook",
    "StructuredPromptDiff",
    "RenderedPromptDiff",
    "diff_structured_prompts",
    "diff_rendered_prompts",
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
