"""Widget renderer for Jupyter notebook visualization."""

import json
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from ..ir import IntermediateRepresentation
    from ..structured_prompt import StructuredPrompt

# Module-level flag to track if bundle has been injected
_bundle_injected = False


def _get_widget_bundle() -> str:
    """
    Get the widget JavaScript bundle.

    Returns
    -------
    str
        JavaScript bundle content as string.
    """
    # Import from utils.py which has the path logic
    from . import utils

    js_path = utils.get_widget_path() / "index.js"

    if not js_path.exists():
        raise FileNotFoundError(
            f"Widget bundle not found at {js_path}. "
            "Run 'pnpm build' from the repository root to build the widgets."
        )

    js_bundle = js_path.read_text()

    return js_bundle


def _render_widget_html(data: dict[str, Any], *, force_inject: bool = False) -> str:
    """
    Render widget HTML with singleton injection strategy.

    Parameters
    ----------
    data : dict[str, Any]
        JSON data to embed in the widget (from toJSON()).
    force_inject : bool, optional
        If True, always inject the bundle even if already injected.
        Default is False.

    Returns
    -------
    str
        HTML string with widget markup.
    """
    global _bundle_injected

    # Determine if we need to inject the bundle
    should_inject = force_inject or not _bundle_injected

    html_parts = []

    if should_inject:
        # Get JavaScript bundle
        js_bundle = _get_widget_bundle()

        # Inject JavaScript bundle (includes widget styles with KaTeX from CDN)
        html_parts.append(f'<script id="tp-widget-bundle">{js_bundle}</script>')

        # Mark as injected
        _bundle_injected = True

    # Serialize data to JSON
    json_data = json.dumps(data)

    # Create widget container with embedded data
    html_parts.append(f"""
<div class="tp-widget-root" data-tp-widget>
    <script data-role="tp-widget-data" type="application/json">{json_data}</script>
    <div class="tp-widget-mount"></div>
</div>
""")

    return "".join(html_parts)


def render_structured_prompt_html(prompt: "StructuredPrompt") -> str:
    """
    Render a StructuredPrompt as HTML widget.

    Parameters
    ----------
    prompt : StructuredPrompt
        The structured prompt to render.

    Returns
    -------
    str
        HTML string for Jupyter notebook display.
    """
    # Export to JSON
    data = prompt.toJSON()
    return _render_widget_html(data)


def render_ir_html(ir: "IntermediateRepresentation") -> str:
    """
    Render an IntermediateRepresentation as HTML widget.

    Parameters
    ----------
    ir : IntermediateRepresentation
        The intermediate representation to render.

    Returns
    -------
    str
        HTML string for Jupyter notebook display.
    """
    # Export to JSON
    data = ir.toJSON()
    return _render_widget_html(data)
