"""Widget support for Jupyter notebooks."""

from pathlib import Path

_WIDGETS_DIR = Path(__file__).parent


def get_widget_path() -> Path:
    """
    Get the path to bundled JavaScript widgets.

    Returns
    -------
    Path
        Path to the widgets directory containing compiled JavaScript.

    Examples
    --------
    >>> from t_prompts.widgets import get_widget_path
    >>> widget_path = get_widget_path()
    >>> (widget_path / "index.js").exists()
    True
    """
    return _WIDGETS_DIR


def get_widget_js() -> str:
    """
    Load the widget JavaScript bundle.

    Returns
    -------
    str
        The compiled JavaScript widget code.

    Raises
    ------
    FileNotFoundError
        If the widget bundle has not been built.

    Examples
    --------
    >>> from t_prompts.widgets import get_widget_js
    >>> js_code = get_widget_js()
    >>> len(js_code) > 0
    True
    """
    js_path = _WIDGETS_DIR / "index.js"
    if not js_path.exists():
        raise FileNotFoundError(
            f"Widget bundle not found at {js_path}. "
            "Run 'pnpm build' from the repository root to build the widgets."
        )
    return js_path.read_text()
