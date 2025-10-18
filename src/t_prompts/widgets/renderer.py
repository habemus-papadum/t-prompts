"""Widget renderer for Jupyter notebook visualization."""

import json
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    pass

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


def _render_widget_html(data: dict[str, Any], mount_class: str, *, force_inject: bool = False) -> str:
    """
    Render widget HTML with singleton injection strategy.

    Parameters
    ----------
    data : dict[str, Any]
        JSON data to embed in the widget (from toJSON()).
    mount_class : str
        CSS class name for the widget mount point.
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

        # Inject JavaScript bundle (includes widget styles with bundled KaTeX)
        html_parts.append(f'<script id="tp-widget-bundle">{js_bundle}</script>')

        # Mark as injected
        _bundle_injected = True

    # Serialize data to JSON
    json_data = json.dumps(data)

    # Create widget container with embedded data
    html_parts.append(f"""
<div class="tp-widget-root" data-tp-widget>
    <script data-role="tp-widget-data" type="application/json">{json_data}</script>
    <div class="{mount_class}"></div>
</div>
""")

    return "".join(html_parts)
