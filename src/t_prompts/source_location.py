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


def _capture_source_location(skip_frames: int = 1) -> Optional[SourceLocation]:
    """
    Capture source code location information from the call stack.

    Skips a fixed number of frames to reach the caller's code. This simple
    approach works reliably regardless of where the calling code is located
    (user code, demos, library helpers, etc.).

    Parameters
    ----------
    skip_frames : int
        Number of frames to skip (default 1: skip _capture_source_location itself).
        Callers should typically pass 2 to skip both _capture_source_location and
        the immediate caller (e.g., prompt() or clone()).

    Returns
    -------
    SourceLocation | None
        Source location if available, None if unavailable.
    """
    frame = inspect.currentframe()
    if frame is None:
        return None

    try:
        # Skip the specified number of frames
        for _ in range(skip_frames):
            if frame.f_back is None:
                return None
            frame = frame.f_back

        # Extract info directly from the target frame
        frame_file = frame.f_code.co_filename
        filename = Path(frame_file).name
        filepath = str(Path(frame_file).resolve())
        lineno = frame.f_lineno

        return SourceLocation(
            filename=filename,
            filepath=filepath,
            line=lineno,
        )
    finally:
        # Clean up frame references to avoid reference cycles
        del frame


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
