"""MkDocs hooks to inject version from pyproject.toml."""

import tomllib
from pathlib import Path


def on_config(config, **kwargs):
    """Read version from pyproject.toml and add it to MkDocs config."""
    pyproject_path = Path(__file__).parent.parent / "pyproject.toml"

    with open(pyproject_path, "rb") as f:
        pyproject = tomllib.load(f)

    version = pyproject.get("project", {}).get("version", "unknown")

    # Add version to extra context so it's available in templates
    if "extra" not in config:
        config["extra"] = {}

    config["extra"]["version"] = version

    return config
