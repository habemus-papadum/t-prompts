"""Widget renderer for Jupyter notebook visualization."""

import hashlib
import json
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .widget import Widget


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
        # Detect dev mode by checking for .git directory
        repo_root = js_path.parent.parent.parent.parent  # Go up to repo root
        is_dev_mode = (repo_root / ".git").exists()

        if is_dev_mode:
            error_msg = (
                f"Widget bundle not found at {js_path}.\n"
                "Development mode detected. Please build the widgets first:\n"
                "  pnpm --filter @t-prompts/widgets build"
            )
        else:
            error_msg = (
                f"Widget bundle not found at {js_path}.\n"
                "Missing widget assets. This appears to be an installation issue.\n"
                "Please report this at: https://github.com/habemus-papadum/t-prompts/issues"
            )

        raise FileNotFoundError(error_msg)

    js_bundle = js_path.read_text()

    return js_bundle


def js_prelude() -> str:
    """
    Create a script tag containing the widget JavaScript bundle.

    This function generates HTML with the widget initialization JavaScript.
    The script tag includes cache-busting via a hash-based ID, and the
    auto-initialization machinery will handle deduplication across multiple
    calls.

    Use this function to inject widget JavaScript into web pages, HTML templates,
    or other contexts where you need explicit control over script loading.

    For Jupyter notebooks, use setup_notebook() instead, which wraps this
    in a displayable Widget.

    Returns
    -------
    str
        HTML string containing a <script> tag with the widget bundle.

    Examples
    --------
    In a FastAPI endpoint:
        >>> from fastapi.responses import HTMLResponse
        >>> @app.get("/")
        >>> async def root():
        ...     return HTMLResponse(f'''
        ...         <html>
        ...             <head>{t_prompts.js_prelude()}</head>
        ...             <body>...</body>
        ...         </html>
        ...     ''')
    """
    js_bundle = _get_widget_bundle()

    # Create hash for cache busting (first 8 chars of SHA256)
    bundle_hash = hashlib.sha256(js_bundle.encode()).hexdigest()[:8]

    return f'<script id="tp-widget-bundle-{bundle_hash}">{js_bundle}</script>'


def setup_notebook() -> "Widget":
    """
    Create a Widget that initializes the t-prompts widget system in a notebook.

    This function should be called at the top of Jupyter notebooks to inject
    the widget JavaScript. After calling this once, all subsequent widget
    renderings will work correctly without re-injecting the JavaScript bundle.

    Returns
    -------
    Widget
        A Widget containing the initialization JavaScript.

    Examples
    --------
    At the top of a Jupyter notebook:
        >>> import t_prompts
        >>> display(t_prompts.setup_notebook())

    Or simply:
        >>> import t_prompts
        >>> t_prompts.setup_notebook()

    Notes
    -----
    This must be called before rendering any t-prompts widgets in the notebook.
    The JavaScript handles deduplication automatically, so calling this multiple
    times is safe but unnecessary.
    """
    from .widget import Widget

    return Widget(js_prelude())


def _render_widget_html(data: dict[str, Any], mount_class: str, *, force_inject: bool = False) -> str:
    """
    Render widget HTML without the JavaScript bundle.

    The JavaScript bundle should be loaded separately using js_prelude() or
    setup_notebook(). This reduces data transfer when rendering multiple widgets.

    Parameters
    ----------
    data : dict[str, Any]
        JSON data to embed in the widget (from toJSON()).
    mount_class : str
        CSS class name for the widget mount point.
    force_inject : bool, optional
        Deprecated. No longer has any effect. The bundle is never injected.
        Default is False.

    Returns
    -------
    str
        HTML string with widget markup.

    Notes
    -----
    In Jupyter notebooks, make sure to call setup_notebook() at the top of
    your notebook before rendering widgets:
        >>> import t_prompts
        >>> display(t_prompts.setup_notebook())

    In web applications, inject js_prelude() into your HTML template.
    """
    # Serialize data to JSON
    json_data = json.dumps(data)

    # Create widget container with embedded data and helper message
    # The helper message will be replaced by the widget when JavaScript initializes
    helper_message = (
        '<div class="tp-widget-helper" style="'
        "padding: 1em; "
        "border: 1px solid #e0e0e0; "
        "border-radius: 4px; "
        "background: #f9f9f9; "
        "color: #666; "
        "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; "
        'font-size: 14px;">'
        "<strong>Widget not initialized.</strong> "
        'Run <code style="background: #fff; padding: 2px 6px; border-radius: 3px;">t_prompts.setup_notebook()</code> '
        "at the top of your notebook to enable widget rendering."
        "</div>"
    )

    return f"""
<div class="tp-widget-root" data-tp-widget>
    <script data-role="tp-widget-data" type="application/json">{json_data}</script>
    <div class="{mount_class}">{helper_message}</div>
</div>
"""
