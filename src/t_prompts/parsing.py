"""Parsing utilities for format specs and render hints."""


def parse_format_spec(format_spec: str, expression: str) -> tuple[str, str]:
    """
    Parse format spec mini-language: "key : render_hints".

    Rules:
    - If format_spec is empty, key = expression
    - If format_spec is "_", key = expression
    - If format_spec contains ":", split on first colon:
      - First part is key (trimmed if there's a colon, preserving whitespace in key name)
      - Second part (if present) is render_hints
    - Otherwise, format_spec is the key as-is (preserving any whitespace)

    Parameters
    ----------
    format_spec : str
        The format specification from the t-string
    expression : str
        The expression text (fallback for key derivation)

    Returns
    -------
    tuple[str, str]
        (key, render_hints) where render_hints may be empty string
    """
    if not format_spec or format_spec == "_":
        # Use expression as key, no render hints
        return expression, ""

    # Split on first colon to separate key from render hints
    if ":" in format_spec:
        key_part, hints_part = format_spec.split(":", 1)
        # Trim key when there's a colon delimiter
        return key_part.strip(), hints_part
    else:
        # No colon, entire format_spec is the key (trim leading/trailing, preserve internal whitespace)
        return format_spec.strip(), ""


def parse_separator(render_hints: str) -> str:
    """
    Parse the separator from render hints.

    Looks for "sep=<value>" in the render hints. Returns "\n" as default.

    Parameters
    ----------
    render_hints : str
        The render hints string (everything after first colon in format spec).

    Returns
    -------
    str
        The separator value, or "\n" if not specified.
    """
    if not render_hints:
        return "\n"

    # Look for "sep=<value>" in render hints
    for hint in render_hints.split(":"):
        if hint.startswith("sep="):
            return hint[4:]  # Extract everything after "sep="

    return "\n"


def parse_render_hints(render_hints: str, key: str) -> dict[str, str]:
    """
    Parse render hints into a structured format.

    Extracts special hints like xml=<value> and header=<heading> (or just header).
    Leading and trailing whitespace is trimmed from hint specifications.

    Parameters
    ----------
    render_hints : str
        The render hints string (everything after first colon in format spec).
    key : str
        The interpolation key (used as default for header if no value specified).

    Returns
    -------
    dict[str, str]
        Dictionary with parsed hints. Possible keys: 'xml', 'header', 'sep'.
    """
    if not render_hints:
        return {}

    result = {}

    # Split on colon and process each hint
    for hint in render_hints.split(":"):
        hint = hint.strip()  # Trim leading/trailing whitespace

        if hint.startswith("xml="):
            # Extract XML tag name (no whitespace allowed in value)
            xml_value = hint[4:].strip()
            if " " in xml_value or "\t" in xml_value or "\n" in xml_value:
                raise ValueError(f"XML tag name cannot contain whitespace: {xml_value!r}")
            result["xml"] = xml_value

        elif hint.startswith("header="):
            # Extract header text (whitespace allowed in heading)
            header_value = hint[7:].strip()
            result["header"] = header_value

        elif hint == "header":
            # No value specified, use the key as heading
            result["header"] = key

        elif hint.startswith("sep="):
            # Extract separator value
            result["sep"] = hint[4:]

    return result
