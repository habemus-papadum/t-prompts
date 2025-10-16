"""Widget system for rendering structured prompts in Jupyter and HTML."""

from .config import WidgetConfig, get_default_widget_config, set_default_widget_config
from .export import create_widget_gallery, save_widget_html
from .preview import run_preview
from .renderer import _render_widget_html
from .utils import get_widget_js, get_widget_path
from .widget import Widget

__all__ = [
    "Widget",
    "WidgetConfig",
    "get_default_widget_config",
    "set_default_widget_config",
    "get_widget_path",
    "get_widget_js",
    "save_widget_html",
    "create_widget_gallery",
    "run_preview",
    "_render_widget_html",
]
