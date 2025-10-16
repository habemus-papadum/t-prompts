"""Widget configuration for Jupyter notebook rendering."""

import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class WidgetConfig:
    """
    Configuration for widget rendering in Jupyter notebooks.

    Attributes
    ----------
    wrapping : bool
        If True, text wraps in the output container. If False, uses horizontal scroll.
        Default is True.
    sourcePrefix : str
        Path prefix to remove from source locations to create relative paths.
        Default is current working directory.
    """

    wrapping: bool = True
    sourcePrefix: str = ""

    def __post_init__(self):
        """Set sourcePrefix to cwd if empty."""
        if not self.sourcePrefix:
            self.sourcePrefix = os.getcwd()


# Module-level default config
_default_config: Optional[WidgetConfig] = None


def get_default_widget_config() -> WidgetConfig:
    """
    Get the package-level default widget configuration.

    Returns
    -------
    WidgetConfig
        The default configuration. If not set, creates a new one with defaults.
    """
    global _default_config
    if _default_config is None:
        _default_config = WidgetConfig()
    return _default_config


def set_default_widget_config(config: WidgetConfig) -> None:
    """
    Set the package-level default widget configuration.

    This is global state that affects all widget rendering when no explicit
    config is provided. Useful for setting preferences once in a notebook.

    Parameters
    ----------
    config : WidgetConfig
        The configuration to use as the default.

    Examples
    --------
    >>> from t_prompts import set_default_widget_config, WidgetConfig
    >>> # Disable wrapping by default
    >>> set_default_widget_config(WidgetConfig(wrapping=False))
    >>> # Set custom source prefix
    >>> set_default_widget_config(WidgetConfig(sourcePrefix="/home/user/project"))
    """
    global _default_config
    _default_config = config
