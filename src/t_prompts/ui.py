"""UI utilities for rendering IntermediateRepresentation in notebooks."""

import html
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .core import IntermediateRepresentation

# Try to import PIL for image support (optional dependency)
try:
    from PIL import Image as PILImage

    HAS_PIL = True
except ImportError:
    PILImage = None  # type: ignore
    HAS_PIL = False


def render_ir_to_html(ir: "IntermediateRepresentation") -> str:
    """
    Render an IntermediateRepresentation to HTML for Jupyter/Marimo notebooks.

    Returns a simple HTML rendering of the intermediate representation with
    text chunks in code blocks and images centered in divs.

    Parameters
    ----------
    ir : IntermediateRepresentation
        The intermediate representation to render.

    Returns
    -------
    str
        HTML string suitable for notebook display.
    """
    parts = []

    # Add basic styling
    parts.append('<div style="font-family: monospace; border: 1px solid #ccc; padding: 10px; margin: 10px 0;">')

    # Render each chunk
    for chunk in ir.chunks:
        if hasattr(chunk, "text"):  # TextChunk
            # Render text in a code block
            escaped_text = html.escape(chunk.text)
            parts.append(
                f'<pre style="background-color: #f5f5f5; padding: 10px; margin: 5px 0; '
                f'border-radius: 4px; overflow-x: auto;">{escaped_text}</pre>'
            )
        elif hasattr(chunk, "image"):  # ImageChunk
            # Render image centered in a div with base64 encoding
            if HAS_PIL and PILImage:
                import base64
                import io

                img_io = io.BytesIO()
                chunk.image.save(img_io, format="PNG")
                img_io.seek(0)
                img_base64 = base64.b64encode(img_io.read()).decode("utf-8")
                data_url = f"data:image/png;base64,{img_base64}"

                parts.append(
                    f'<div style="text-align: center; margin: 10px 0;">'
                    f'<img src="{data_url}" style="max-width: 100%; height: auto;" />'
                    f"</div>"
                )
            else:
                parts.append('<div style="color: #888; font-style: italic;">Image chunk (PIL not available)</div>')

    parts.append("</div>")

    return "".join(parts)
