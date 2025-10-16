"""Custom exceptions for structured-prompts."""


class StructuredPromptsError(Exception):
    """Base exception for all structured-prompts errors."""


class UnsupportedValueTypeError(StructuredPromptsError):
    """Raised when an interpolation value is neither str nor StructuredPrompt."""

    def __init__(self, key: str, value_type: type, expression: str):
        self.key = key
        self.value_type = value_type
        self.expression = expression
        super().__init__(
            f"Unsupported value type for interpolation '{expression}' (key='{key}'): "
            f"expected str or StructuredPrompt, got {value_type.__name__}"
        )


class DuplicateKeyError(StructuredPromptsError):
    """Raised when duplicate keys are found and allow_duplicate_keys=False."""

    def __init__(self, key: str):
        self.key = key
        super().__init__(
            f"Duplicate key '{key}' found. Use allow_duplicate_keys=True to allow duplicates, "
            "or use different format specs to create unique keys."
        )


class MissingKeyError(StructuredPromptsError, KeyError):
    """Raised when a key is not found during dict-like access."""

    def __init__(self, key: str, available_keys: list[str]):
        self.key = key
        self.available_keys = available_keys
        super().__init__(f"Key '{key}' not found. Available keys: {', '.join(repr(k) for k in available_keys)}")


class NotANestedPromptError(StructuredPromptsError):
    """Raised when attempting to index into a non-nested interpolation."""

    def __init__(self, key: str):
        self.key = key
        super().__init__(
            f"Cannot index into interpolation '{key}': value is not a StructuredPrompt. "
            "Only nested prompts support indexing."
        )


class EmptyExpressionError(StructuredPromptsError):
    """Raised when an empty expression {} is encountered."""

    def __init__(self):
        super().__init__(
            "Empty expression {{}} is not allowed. All interpolations must have a valid expression or format spec."
        )


class DedentError(StructuredPromptsError):
    """Raised when dedenting configuration is invalid or dedenting fails."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class ImageRenderError(StructuredPromptsError):
    """Raised when attempting to render a prompt containing images to text."""

    def __init__(self):
        super().__init__(
            "Cannot render prompt containing images to text. "
            "Prompts with images can only be accessed through the prompt structure. "
            "Use p['image_key'].value to access the PIL Image object directly."
        )


class PromptReuseError(StructuredPromptsError):
    """Raised when attempting to nest a StructuredPrompt in multiple locations."""

    def __init__(self, prompt, current_parent, new_parent):

        self.prompt = prompt
        self.current_parent = current_parent
        self.new_parent = new_parent

        # Build helpful error message
        current_desc = self._describe_parent(current_parent)
        new_desc = self._describe_parent(new_parent)

        super().__init__(
            f"Cannot nest StructuredPrompt (id={prompt.id}) in multiple locations. "
            f"Already nested in {current_desc}, cannot also nest in {new_desc}. "
            f"Each StructuredPrompt can only be in one location at a time. "
            f"Create separate prompt instances if you need to reuse content."
        )

    def _describe_parent(self, parent):
        """Create a helpful description of the parent element."""
        from .element import ListInterpolation

        # Handle objects with parent and key attributes (new structure or temp wrappers)
        if hasattr(parent, 'parent') and hasattr(parent, 'key') and parent.key is not None:
            parent_type = type(parent).__name__
            return f"{parent_type}(key='{parent.key}')"
        elif isinstance(parent, ListInterpolation):
            return f"ListInterpolation(key='{parent.key}')"
        else:
            return f"{type(parent).__name__}"
