"""Source code location tracking for structured prompts."""

import inspect
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional


@dataclass(frozen=True, slots=True)
class SourceLocation:
    """
    Source code location information for an Element.

    All fields are optional to handle cases where source information is unavailable
    (e.g., REPL, eval, exec). Use the is_available property to check if location
    information is present.

    This information is captured directly from Python stack frames without reading
    source files, making it fast and lightweight.

    Attributes
    ----------
    filename : str | None
        Short filename (e.g., 'script.py', '<stdin>', '<string>').
    filepath : str | None
        Full absolute path to the file.
    line : int | None
        Line number where prompt was created (1-indexed).
    """

    filename: Optional[str] = None
    filepath: Optional[str] = None
    line: Optional[int] = None

    @property
    def is_available(self) -> bool:
        """
        Check if source location information is available.

        Returns
        -------
        bool
            True if location info is present (filename is not None), False otherwise.
        """
        return self.filename is not None

    def format_location(self) -> str:
        """
        Format location as a readable string.

        Returns
        -------
        str
            Formatted location string (e.g., "script.py:42" or "<unavailable>").
        """
        if not self.is_available:
            return "<unavailable>"
        parts = [self.filename or "<unknown>"]
        if self.line is not None:
            parts.append(str(self.line))
        return ":".join(parts)

    def toJSON(self) -> dict[str, Any]:
        """
        Convert SourceLocation to a JSON-serializable dictionary.

        Returns
        -------
        dict[str, Any]
            Dictionary with filename, filepath, line.
        """
        return {
            "filename": self.filename,
            "filepath": self.filepath,
            "line": self.line,
        }


def _capture_source_location() -> Optional[SourceLocation]:
    """
    Capture source code location information from the call stack.

    Walks up the stack to find the first frame outside this library
    (the actual user code that called prompt()). Only uses information
    directly available from the stack frame without reading source files.

    Returns
    -------
    SourceLocation | None
        Source location if available, None if unavailable.
    """
    # Walk up the stack to find the first non-library frame
    frame = inspect.currentframe()
    if frame is None:
        return None

    # Get the directory of this library to identify internal frames
    library_dir = str(Path(__file__).parent.resolve())

    try:
        # Skip frames until we're out of this library
        while frame is not None:
            frame_file = frame.f_code.co_filename

            # Check if we're outside the library
            if not frame_file.startswith(library_dir):
                # Found user code frame - extract info directly from frame
                filename = Path(frame_file).name
                filepath = str(Path(frame_file).resolve())
                lineno = frame.f_lineno

                return SourceLocation(
                    filename=filename,
                    filepath=filepath,
                    line=lineno,
                )

            frame = frame.f_back
    finally:
        # Clean up frame references to avoid reference cycles
        del frame

    return None


def _serialize_source_location(source_location: Optional[SourceLocation]) -> Optional[dict[str, Any]]:
    """
    Serialize a SourceLocation to a JSON-compatible dict.

    Parameters
    ----------
    source_location : SourceLocation | None
        The source location to serialize.

    Returns
    -------
    dict[str, Any] | None
        Dictionary with filename, filepath, line if available, None otherwise.
    """
    if source_location is None or not source_location.is_available:
        return None
    return {
        "filename": source_location.filename,
        "filepath": source_location.filepath,
        "line": source_location.line,
    }
