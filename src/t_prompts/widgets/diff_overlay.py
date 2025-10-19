"""Helpers for rendering the structured prompt widget with diff overlays."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from ..diff import (
    RenderedPromptDiff,
    StructuredPromptDiff,
    diff_rendered_prompts,
    diff_structured_prompts,
)
from ..structured_prompt import StructuredPrompt
from .config import WidgetConfig
from .renderer import _render_widget_html
from .widget import Widget


@dataclass(slots=True)
class DiffOverlayPayload:
    """Container describing optional diff context for widget rendering."""

    prior: Optional[StructuredPrompt]
    structured_diff: Optional[StructuredPromptDiff]
    rendered_diff: Optional[RenderedPromptDiff]


def _resolve_diff_payload(
    after: StructuredPrompt,
    *,
    before: Optional[StructuredPrompt] = None,
    structured_diff: Optional[StructuredPromptDiff] = None,
    rendered_diff: Optional[RenderedPromptDiff] = None,
) -> DiffOverlayPayload:
    """Resolve the concrete diff artefacts to use for rendering."""

    prior = before

    if structured_diff is None and prior is not None:
        structured_diff = diff_structured_prompts(prior, after)
    elif structured_diff is not None and prior is None:
        prior = structured_diff.before

    if rendered_diff is None and prior is not None:
        rendered_diff = diff_rendered_prompts(prior, after)
    elif rendered_diff is not None and prior is None:
        prior = rendered_diff.before

    return DiffOverlayPayload(prior=prior, structured_diff=structured_diff, rendered_diff=rendered_diff)


def build_diff_overlay_widget(
    after: StructuredPrompt,
    *,
    before: Optional[StructuredPrompt] = None,
    structured_diff: Optional[StructuredPromptDiff] = None,
    rendered_diff: Optional[RenderedPromptDiff] = None,
    config: Optional[WidgetConfig] = None,
) -> Widget:
    """Render the primary widget with optional diff overlays."""

    payload = _resolve_diff_payload(
        after,
        before=before,
        structured_diff=structured_diff,
        rendered_diff=rendered_diff,
    )

    compiled = after.ir().compile()
    data = compiled.widget_data(config)

    if payload.prior is not None:
        data["prior_prompt_ir"] = payload.prior.ir().toJSON()

    if payload.structured_diff is not None:
        data["structured_diff"] = payload.structured_diff.to_widget_data()

    if payload.rendered_diff is not None:
        data["rendered_diff"] = payload.rendered_diff.to_widget_data()

    html = _render_widget_html(data, "tp-widget-mount")
    return Widget(html)


def build_diff_overlay_data(
    after: StructuredPrompt,
    *,
    before: Optional[StructuredPrompt] = None,
    structured_diff: Optional[StructuredPromptDiff] = None,
    rendered_diff: Optional[RenderedPromptDiff] = None,
    config: Optional[WidgetConfig] = None,
) -> dict[str, object]:
    """Return widget JSON data including diff payloads without rendering HTML."""

    payload = _resolve_diff_payload(
        after,
        before=before,
        structured_diff=structured_diff,
        rendered_diff=rendered_diff,
    )

    compiled = after.ir().compile()
    data = compiled.widget_data(config)

    if payload.prior is not None:
        data["prior_prompt_ir"] = payload.prior.ir().toJSON()

    if payload.structured_diff is not None:
        data["structured_diff"] = payload.structured_diff.to_widget_data()

    if payload.rendered_diff is not None:
        data["rendered_diff"] = payload.rendered_diff.to_widget_data()

    return data
