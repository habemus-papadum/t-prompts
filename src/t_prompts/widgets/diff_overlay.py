"""Structured prompt diff overlay widget plumbing."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Union

from ..diff import (
    RenderedPromptDiff,
    StructuredPromptDiff,
    diff_rendered_prompts,
    diff_structured_prompts,
)
from ..ir import CompiledIR, IntermediateRepresentation
from ..structured_prompt import StructuredPrompt
from .config import WidgetConfig
from .renderer import _render_widget_html
from .widget import Widget

PromptLike = Union[StructuredPrompt, IntermediateRepresentation, CompiledIR]


def _ensure_compiled_ir(prompt: PromptLike) -> CompiledIR:
    """Normalize prompt-like input to a compiled IR instance."""

    if isinstance(prompt, CompiledIR):
        return prompt

    if isinstance(prompt, IntermediateRepresentation):
        return prompt.compile()

    if isinstance(prompt, StructuredPrompt):
        return prompt.ir().compile()

    raise TypeError(
        "Expected StructuredPrompt, IntermediateRepresentation, or CompiledIR "
        f"for diff overlay, received {type(prompt)!r}."
    )


def _ensure_ir(prompt: PromptLike) -> IntermediateRepresentation:
    """Normalize prompt-like input to an intermediate representation."""

    if isinstance(prompt, IntermediateRepresentation):
        return prompt

    if isinstance(prompt, CompiledIR):
        return prompt.ir

    if isinstance(prompt, StructuredPrompt):
        return prompt.ir()

    raise TypeError(
        "Expected StructuredPrompt, IntermediateRepresentation, or CompiledIR "
        f"for diff overlay, received {type(prompt)!r}."
    )


@dataclass
class PromptDiffOverlay:
    """Widget wrapper that augments the prompt viewer with diff context."""

    after: PromptLike
    before: Optional[PromptLike] = None
    structured_diff: Optional[StructuredPromptDiff] = None
    rendered_diff: Optional[RenderedPromptDiff] = None
    config: Optional[WidgetConfig] = None

    def __post_init__(self) -> None:
        self._compiled_after = _ensure_compiled_ir(self.after)
        self._after_prompt = self._compiled_after.ir.source_prompt

        if self.before is not None and self._after_prompt is None:
            raise ValueError("Diff overlay requires the 'after' prompt to originate from a StructuredPrompt.")

        self._before_ir: Optional[IntermediateRepresentation]
        self._before_prompt: Optional[StructuredPrompt]

        before_prompt: Optional[StructuredPrompt] = None
        before_ir: Optional[IntermediateRepresentation] = None

        if self.before is not None:
            before_ir = _ensure_ir(self.before)
            before_prompt = before_ir.source_prompt
            if before_prompt is None:
                raise ValueError("Prior prompt for diff overlay must originate from a StructuredPrompt.")

        if self.structured_diff is None and before_prompt is not None and self._after_prompt is not None:
            self.structured_diff = diff_structured_prompts(before_prompt, self._after_prompt)

        if self.rendered_diff is None and before_prompt is not None and self._after_prompt is not None:
            self.rendered_diff = diff_rendered_prompts(before_prompt, self._after_prompt)

        if self.structured_diff is not None:
            before_prompt = self.structured_diff.before
            before_ir = before_prompt.ir()

        if self.rendered_diff is not None:
            before_prompt = self.rendered_diff.before
            before_ir = before_prompt.ir()

        self._before_prompt = before_prompt
        self._before_ir = before_ir

    def widget_data(self, config: Optional[WidgetConfig] = None) -> dict[str, object]:
        """Build JSON payload for the overlay widget."""

        active_config = config or self.config
        data = self._compiled_after.widget_data(active_config)
        data["widget_mode"] = "prompt-with-diff"

        if self._before_ir is not None:
            data["prior_prompt_ir"] = self._before_ir.toJSON()

        if self._before_prompt is not None:
            data["prior_prompt"] = self._before_prompt.toJSON()

        if self.structured_diff is not None:
            data["structured_diff"] = self.structured_diff.to_widget_data()

        if self.rendered_diff is not None:
            data["rendered_diff"] = self.rendered_diff.to_widget_data()

        return data

    def widget(self, config: Optional[WidgetConfig] = None) -> Widget:
        """Create the notebook widget for the overlay."""

        data = self.widget_data(config)
        html = _render_widget_html(data, "tp-widget-mount")
        return Widget(html)

    def _repr_html_(self) -> str:
        """Return HTML representation for notebook display."""

        return self.widget()._repr_html_()


def render_prompt_diff_overlay(
    before: StructuredPrompt,
    after: StructuredPrompt,
    *,
    config: Optional[WidgetConfig] = None,
) -> Widget:
    """Convenience helper that computes all diffs and returns a widget."""

    overlay = PromptDiffOverlay(
        after=after,
        before=before,
        structured_diff=diff_structured_prompts(before, after),
        rendered_diff=diff_rendered_prompts(before, after),
        config=config,
    )
    return overlay.widget(config)
