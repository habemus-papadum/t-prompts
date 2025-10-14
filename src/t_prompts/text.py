"""Text processing utilities for dedenting and trimming template strings."""

from .exceptions import DedentError


def process_dedent(
    strings: tuple[str, ...], *, dedent: bool, trim_leading: bool, trim_empty_leading: bool, trim_trailing: bool
) -> tuple[str, ...]:
    """
    Process dedenting and trimming on template strings.

    This function applies four optional transformations to the static text segments
    of a t-string template:

    1. **Trim leading line** (trim_leading): Remove the first line of the first static
       if it ends in newline and contains only whitespace.
    2. **Trim empty leading lines** (trim_empty_leading): After removing the first line,
       remove any subsequent lines that are empty (just newline with no whitespace).
    3. **Trim trailing lines** (trim_trailing): Remove trailing lines that are just
       newlines from the last static.
    4. **Dedent** (dedent): Find the first non-empty line across all statics, count
       its leading spaces, and remove that many spaces from every line in all statics.

    Parameters
    ----------
    strings : tuple[str, ...]
        The static text segments from the t-string template.
    dedent : bool
        If True, dedent all lines by the indent level of the first non-empty line.
    trim_leading : bool
        If True, remove the first line if it's whitespace-only ending in newline.
    trim_empty_leading : bool
        If True, remove empty lines after the first line in the first static.
    trim_trailing : bool
        If True, remove trailing newline-only lines from the last static.

    Returns
    -------
    tuple[str, ...]
        The processed strings tuple.

    Raises
    ------
    DedentError
        If mixed tabs and spaces are found in indentation during dedenting.
    """
    if not strings:
        return strings

    # Convert to list for mutation
    result = list(strings)

    # Step 1: Trim leading line
    if trim_leading and result[0]:
        first = result[0]
        # Check if first line ends in newline and contains only whitespace
        if "\n" in first:
            first_line_end = first.index("\n") + 1
            first_line = first[:first_line_end]
            # Check if it's whitespace-only (excluding the newline)
            if first_line[:-1].strip() == "":
                # Remove this line
                result[0] = first[first_line_end:]
        elif first.startswith("\n"):
            # Special case: starts with newline (empty first line)
            result[0] = first[1:]

    # Step 2: Trim empty leading lines
    if trim_empty_leading and result[0]:
        first = result[0]
        # Remove lines that are just "\n" (no whitespace, just newline)
        while first.startswith("\n"):
            first = first[1:]
        result[0] = first

    # Step 3: Trim trailing lines
    if trim_trailing and result[-1]:
        last = result[-1]
        # Remove all trailing whitespace (including newlines and spaces)
        # Split into lines and work backwards
        if last:
            lines = last.split("\n")
            # Remove trailing empty/whitespace-only lines
            while lines and lines[-1].strip() == "":
                lines.pop()
            # Rejoin
            result[-1] = "\n".join(lines)

    # Step 4: Dedent
    if dedent:
        # Find the first non-empty line or whitespace-only line to determine indent level
        indent_level = None
        for s in result:
            if not s:
                continue
            lines = s.split("\n")
            for line in lines:
                if line.strip():  # Non-empty line with content
                    # Count leading spaces
                    leading = line[: len(line) - len(line.lstrip())]
                    # Check for tabs
                    if "\t" in leading:
                        raise DedentError("Mixed tabs and spaces in indentation are not allowed")
                    indent_level = len(leading)
                    break
                elif line:  # Whitespace-only line (but not empty string)
                    # Also consider whitespace-only lines for indent level
                    # Check for tabs
                    if "\t" in line:
                        raise DedentError("Mixed tabs and spaces in indentation are not allowed")
                    # Use this as indent level if we haven't found one yet
                    if indent_level is None:
                        indent_level = len(line)
            if indent_level is not None:
                break

        # Apply dedenting if we found an indent level
        if indent_level is not None and indent_level > 0:
            for i, s in enumerate(result):
                if not s:
                    continue
                lines = s.split("\n")
                dedented_lines = []
                for line in lines:
                    if line.strip():  # Non-empty line
                        # Remove indent_level spaces
                        if line.startswith(" " * indent_level):
                            dedented_lines.append(line[indent_level:])
                        else:
                            # Line has less indentation than expected
                            # Remove what we can
                            leading = line[: len(line) - len(line.lstrip())]
                            if len(leading) > 0:
                                dedented_lines.append(line[len(leading) :])
                            else:
                                dedented_lines.append(line)
                    else:
                        # Empty line (just whitespace) - dedent it too
                        if line.startswith(" " * indent_level):
                            dedented_lines.append(line[indent_level:])
                        else:
                            # Line has less indentation than expected, remove what we can
                            leading = line[: len(line) - len(line.lstrip())]
                            if len(leading) > 0:
                                dedented_lines.append(line[len(leading) :])
                            else:
                                dedented_lines.append(line)
                result[i] = "\n".join(dedented_lines)

    return tuple(result)
