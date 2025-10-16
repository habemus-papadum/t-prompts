"""Live preview server for widget development.

This module provides a development server that:
- Displays a structured prompt widget in the browser
- Watches source files for changes and auto-reloads
- Provides a simple API for creating widget demos
"""

import argparse
import socket
import sys
import threading
import time
import webbrowser
from collections.abc import Callable
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..structured_prompt import StructuredPrompt

try:
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer

    WATCHDOG_AVAILABLE = True
except ImportError:
    WATCHDOG_AVAILABLE = False


class WidgetPreviewHandler(SimpleHTTPRequestHandler):
    """HTTP handler that serves the widget preview."""

    def __init__(self, *args, widget_html_func=None, reload_trigger=None, **kwargs):
        self.widget_html_func = widget_html_func
        self.reload_trigger = reload_trigger
        super().__init__(*args, **kwargs)

    def do_GET(self):
        """Handle GET requests."""
        if self.path == "/" or self.path == "/index.html":
            try:
                print("\n[GET /] Generating HTML...")
                self.send_response(200)
                self.send_header("Content-type", "text/html; charset=utf-8")
                # Prevent caching
                self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
                self.send_header("Pragma", "no-cache")
                self.send_header("Expires", "0")
                if self.reload_trigger:
                    self.send_header("X-Reload-Time", str(self.reload_trigger.get("last_reload", 0)))
                self.end_headers()
                html = self.widget_html_func()
                html_size = len(html)
                print(f"[GET /] Generated {html_size} bytes of HTML")
                if html_size < 500:
                    print("[GET /] WARNING: HTML is very small, content might be missing!")
                    print(f"[GET /] HTML preview: {html[:500]}")
                self.wfile.write(html.encode("utf-8"))
            except Exception as e:
                print(f"\n[GET /] ERROR generating HTML: {e}")
                import traceback
                traceback.print_exc()
                # Send error page
                self.send_response(500)
                self.send_header("Content-type", "text/html")
                self.end_headers()
                error_html = f"<html><body><h1>Error</h1><pre>{e}\n\n{traceback.format_exc()}</pre></body></html>"
                self.wfile.write(error_html.encode())
        else:
            # For other paths, use default behavior
            super().do_GET()

    def do_HEAD(self):
        """Handle HEAD requests."""
        if self.path == "/" or self.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            # Prevent caching
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            if self.reload_trigger:
                self.send_header("X-Reload-Time", str(self.reload_trigger.get("last_reload", 0)))
            self.end_headers()
        else:
            super().do_HEAD()

    def log_message(self, format, *args):
        """Override to reduce logging noise."""
        # Log errors and successful GET/HEAD requests (but not polling HEAD requests)
        if args[1][0] in ("4", "5"):
            super().log_message(format, *args)
        elif self.command == "GET":
            # Log GET requests for debugging
            print(f"GET {self.path} -> {args[1]}")


class FileChangeHandler(FileSystemEventHandler):
    """Handler for file system changes."""

    def __init__(self, callback, watch_extensions=None):
        self.callback = callback
        self.last_modified = time.time()
        self.debounce_seconds = 0.5
        self.watch_extensions = watch_extensions or {".py", ".js", ".ts"}

    def on_modified(self, event):
        """Called when a file is modified."""
        if event.is_directory:
            return

        # Debounce: ignore events that happen too quickly
        now = time.time()
        if now - self.last_modified < self.debounce_seconds:
            return

        # Filter for relevant files
        path = Path(event.src_path)
        if path.suffix in self.watch_extensions and not any(
            part.startswith(".") or part == "__pycache__" for part in path.parts
        ):
            self.last_modified = now
            print(f"\nFile changed: {path}")
            self.callback()


def _generate_html(
    generator_func: Callable[[], "StructuredPrompt"], reload_script: str = "", show_banner: bool = True
) -> str:
    """Generate the full HTML page with widget and auto-reload.

    Parameters
    ----------
    generator_func : callable
        Function that returns a StructuredPrompt to display.
    reload_script : str
        JavaScript code for auto-reload functionality.
    show_banner : bool
        Whether to show the live development banner.

    Returns
    -------
    str
        Complete HTML page with widget.
    """
    # Reset the bundle injection flag to ensure JavaScript is included on every render
    # This is necessary because the flag is a module-level global that persists
    # across renders, and we need the JS bundle on every page reload
    from . import renderer
    renderer._bundle_injected = False

    print(f"  [HTML] Calling generator function: {generator_func.__name__}")
    sp = generator_func()
    print(f"  [HTML] Got StructuredPrompt: {type(sp).__name__}")
    widget_html = sp._repr_html_()
    print(f"  [HTML] Widget HTML size: {len(widget_html)} bytes")

    # Conditionally include banner and its styles
    banner_styles = ""
    banner_html = ""
    reload_message_html = ""

    if show_banner:
        banner_styles = """
        .page-header {
            max-width: 1600px;
            margin: 0 auto 20px;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .page-header h1 {
            margin: 0;
            font-size: 24px;
            color: #333;
        }
        .page-header p {
            margin: 8px 0 0;
            color: #666;
            font-size: 14px;
        }
        .live-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            background: #4caf50;
            border-radius: 50%;
            margin-right: 6px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .reload-message {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2196f3;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            display: none;
            z-index: 1000;
        }
        .reload-message.show {
            display: block;
            animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }"""
        banner_html = """
    <div class="page-header">
        <h1>
            <span class="live-indicator"></span>
            Widget Preview - Live Development
        </h1>
        <p>Edit Python files or widget code and see changes automatically</p>
    </div>"""
        reload_message_html = """
    <div class="reload-message" id="reloadMessage">
        Reloading...
    </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Widget Preview</title>
    <style>
        body {{
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f5f5f5;
        }}
        .widget-wrapper {{
            max-width: 1600px;
            margin: 0 auto;
        }}{banner_styles}
    </style>
    {reload_script}
</head>
<body>{banner_html}
    <div class="widget-wrapper">
        {widget_html}
    </div>{reload_message_html}
</body>
</html>
"""
    return html


def _get_reload_script(check_interval: int = 1000) -> str:
    """Generate JavaScript for auto-reload functionality.

    Parameters
    ----------
    check_interval : int
        Milliseconds between reload checks.

    Returns
    -------
    str
        JavaScript code wrapped in <script> tags.
    """
    return f"""
    <script>
        let lastReloadTime = null;
        const checkInterval = {check_interval};

        async function checkForUpdates() {{
            try {{
                const response = await fetch('/', {{
                    method: 'HEAD',
                    cache: 'no-cache'
                }});
                const reloadTime = response.headers.get('X-Reload-Time');

                if (reloadTime !== null) {{
                    if (lastReloadTime === null) {{
                        // First check, just store the time
                        lastReloadTime = reloadTime;
                    }} else if (reloadTime !== lastReloadTime) {{
                        // Reload time changed, trigger reload
                        console.log('Changes detected, reloading...');
                        const msg = document.getElementById('reloadMessage');
                        msg.classList.add('show');
                        setTimeout(() => {{
                            location.reload();
                        }}, 500);
                    }}
                }}
            }} catch (err) {{
                console.error('Error checking for updates:', err);
            }}
        }}

        // Check for updates periodically
        setInterval(checkForUpdates, checkInterval);

        console.log('Live reload enabled - checking for changes every ' + (checkInterval/1000) + 's');
    </script>
    """


def _find_free_port(start_port: int = 8000, max_attempts: int = 10) -> int:
    """Find a free port starting from start_port.

    Parameters
    ----------
    start_port : int
        Port to start searching from.
    max_attempts : int
        Maximum number of ports to try.

    Returns
    -------
    int
        Available port number.

    Raises
    ------
    RuntimeError
        If no free port is found.
    """
    for port in range(start_port, start_port + max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("", port))
                return port
        except OSError:
            continue
    raise RuntimeError(f"Could not find a free port in range {start_port}-{start_port + max_attempts}")


def run_preview(
    demo_file: str,
    generator_func: Callable[[], "StructuredPrompt"],
    *,
    port: int = 8000,
    watch: bool = True,
    open_browser: bool = True,
) -> None:
    """Run a live preview server for widget development.

    This function starts an HTTP server that displays the widget generated by
    `generator_func` and watches for file changes to auto-reload.

    Parameters
    ----------
    demo_file : str
        Path to the demo file (usually __file__). This file will be watched for changes.
    generator_func : callable
        Function that returns a StructuredPrompt to display.
    port : int, optional
        Port to run the server on (default: 8000).
    watch : bool, optional
        Enable file watching and auto-reload (default: True).
    open_browser : bool, optional
        Automatically open browser (default: True).

    Examples
    --------
    >>> from t_prompts import prompt
    >>> from t_prompts.widgets import run_preview
    >>>
    >>> def my_prompt():
    ...     return prompt(t"Hello {name:n}")
    >>>
    >>> if __name__ == "__main__":
    ...     run_preview(__file__, my_prompt)
    """
    if watch and not WATCHDOG_AVAILABLE:
        print("WARNING: watchdog package not found. Install it for auto-reload functionality:")
        print("  uv pip install watchdog")
        print("\nRunning without watch mode...\n")
        watch = False

    # Find a free port
    try:
        actual_port = _find_free_port(port)
        if actual_port != port:
            print(f"Port {port} is in use, using port {actual_port} instead")
        port = actual_port
    except RuntimeError as e:
        print(f"Error: {e}")
        sys.exit(1)

    # Determine paths to watch
    demo_path = Path(demo_file).resolve()
    widgets_js_path = Path(__file__).parent  # src/t_prompts/widgets/ (contains index.js, etc.)

    # Store module and function info for reloading
    func_module_name = generator_func.__module__
    func_name = generator_func.__name__

    # Get the actual module object
    func_module = sys.modules.get(func_module_name)

    def get_current_generator():
        """Get the current (possibly reloaded) generator function."""
        if not watch:
            return generator_func

        try:
            # Special handling for __main__ module
            if func_module_name == "__main__":
                # Load the module from file path directly
                import importlib.util
                spec = importlib.util.spec_from_file_location("__demo_main__", demo_path)
                if spec is None or spec.loader is None:
                    print("Warning: Could not create spec for demo file")
                    return generator_func

                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                reloaded_func = getattr(module, func_name)
                print(f"Successfully reloaded {func_name} from {demo_path.name}")
                return reloaded_func
            elif func_module is not None:
                # Normal module reload
                importlib.reload(func_module)
                reloaded_func = getattr(func_module, func_name)
                print(f"Successfully reloaded {func_name} from {func_module_name}")
                return reloaded_func
        except Exception as e:
            print(f"Error: Failed to reload module: {e}")
            import traceback
            traceback.print_exc()
            # Fall back to original function
            return generator_func

        return generator_func

    # Setup file watcher if enabled
    observer = None
    reload_trigger = {"last_reload": time.time()} if watch else None

    if watch:
        observer = Observer()

        def trigger_reload():
            reload_trigger["last_reload"] = time.time()
            print("  -> Triggering reload...")

        handler = FileChangeHandler(trigger_reload, watch_extensions={".py", ".js", ".ts"})

        # Watch the demo file's directory
        observer.schedule(handler, str(demo_path.parent), recursive=False)

        # Watch the widgets JavaScript directory
        if widgets_js_path.exists():
            observer.schedule(handler, str(widgets_js_path), recursive=False)

        observer.start()

    # Setup HTTP server
    reload_script = _get_reload_script() if watch else ""

    def handler_factory(*args, **kwargs):
        return WidgetPreviewHandler(
            *args,
            widget_html_func=lambda: _generate_html(get_current_generator(), reload_script, show_banner=watch),
            reload_trigger=reload_trigger,
            **kwargs
        )

    server = HTTPServer(("localhost", port), handler_factory)

    # Print server info
    print(f"\n{'=' * 60}")
    print("Widget Preview Server")
    print(f"{'=' * 60}")
    print(f"\nServer running at: http://localhost:{port}")
    print(f"Watch mode: {'enabled' if watch else 'disabled'}")

    if watch:
        print("\nWatching for changes in:")
        print(f"  - {demo_path}")
        print(f"  - {widgets_js_path}")

    print("\nPress Ctrl+C to stop the server")
    print(f"{'=' * 60}\n")

    # Open browser
    if open_browser:
        url = f"http://localhost:{port}"
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\nShutting down server...")
        server.shutdown()
    finally:
        if observer:
            observer.stop()
            observer.join()


def main():
    """Command-line interface for the preview server.

    This is kept for backwards compatibility with the old widget_preview.py script.
    """
    parser = argparse.ArgumentParser(description="Live preview server for widget development")
    parser.add_argument("demo_file", nargs="?", help="Path to demo file with generator function")
    parser.add_argument("--port", type=int, default=8000, help="Port to run the server on (default: 8000)")
    parser.add_argument("--no-watch", action="store_true", help="Disable file watching and auto-reload")
    parser.add_argument("--no-browser", action="store_true", help="Don't open browser automatically")
    args = parser.parse_args()

    if not args.demo_file:
        print("Error: Please provide a demo file path")
        print("Usage: python -m t_prompts.widgets.preview demo_file.py")
        sys.exit(1)

    demo_path = Path(args.demo_file)
    if not demo_path.exists():
        print(f"Error: Demo file not found: {demo_path}")
        sys.exit(1)

    # Import the demo file and look for a generator function
    import importlib.util
    spec = importlib.util.spec_from_file_location("demo", demo_path)
    if spec is None or spec.loader is None:
        print(f"Error: Could not load demo file: {demo_path}")
        sys.exit(1)

    demo_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(demo_module)

    # Look for a generate_structured_prompt or main function
    generator_func = getattr(demo_module, "generate_structured_prompt", None)
    if generator_func is None:
        generator_func = getattr(demo_module, "generate_prompt", None)
    if generator_func is None:
        print("Error: Demo file must define 'generate_structured_prompt()' or 'generate_prompt()' function")
        sys.exit(1)

    run_preview(
        str(demo_path),
        generator_func,
        port=args.port,
        watch=not args.no_watch,
        open_browser=not args.no_browser,
    )


if __name__ == "__main__":
    main()
