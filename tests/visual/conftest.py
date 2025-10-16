"""Pytest configuration for visual widget tests using Playwright."""

import http.server
import socketserver
import threading

import pytest

from t_prompts.widgets import save_widget_html


@pytest.fixture(scope="session")
def widget_test_dir(tmp_path_factory):
    """Create a temporary directory for visual test outputs."""
    return tmp_path_factory.mktemp("widget_tests")


@pytest.fixture(scope="session")
def screenshot_dir(tmp_path_factory):
    """Create a directory for storing screenshots."""
    screenshots = tmp_path_factory.mktemp("screenshots")
    return screenshots


@pytest.fixture
def save_widget_for_test(widget_test_dir):
    """Fixture that provides a function to save widgets to HTML for testing."""

    def _save_widget(widget_obj, filename: str, title: str = "Test Widget"):
        """Save a widget to HTML file in the test directory."""
        output_path = widget_test_dir / filename
        return save_widget_html(widget_obj, output_path, title)

    return _save_widget


@pytest.fixture(scope="session")
def http_server(widget_test_dir):
    """
    Start a simple HTTP server to serve widget HTML files.

    This allows Playwright to load files via http:// instead of file://,
    which provides a more realistic browser environment.
    """
    # Find an available port
    with socketserver.TCPServer(("", 0), None) as s:
        port = s.server_address[1]

    # Create a custom handler that serves from widget_test_dir
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(widget_test_dir), **kwargs)

        def log_message(self, format, *args):
            # Suppress HTTP server logs during tests
            pass

    # Start server in background thread
    server = socketserver.TCPServer(("", port), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    # Yield the server URL
    yield f"http://localhost:{port}"

    # Cleanup
    server.shutdown()


@pytest.fixture
def widget_page(page, http_server, save_widget_for_test):
    """
    Fixture that provides a helper to load a widget into a Playwright page.

    Returns a function that:
    1. Saves the widget to HTML
    2. Loads it in the browser
    3. Waits for widget initialization
    4. Returns the page object for further testing
    """

    def _load_widget(widget_obj, filename: str = "test_widget.html", title: str = "Test Widget"):
        """Load a widget into the browser and wait for it to initialize."""
        # Reset the bundle injection state for each test
        # This ensures the widget HTML includes the full bundle
        from t_prompts.widgets import renderer as widget_renderer

        widget_renderer._bundle_injected = False

        # Save widget to HTML (will include full bundle now)
        save_widget_for_test(widget_obj, filename, title)

        # Navigate to the widget page
        url = f"{http_server}/{filename}"
        page.goto(url)

        # Wait for widget container to be visible (not just present)
        page.wait_for_selector('[data-tp-widget]', state='visible', timeout=5000)

        # Give a small additional delay for JavaScript initialization
        page.wait_for_timeout(200)

        return page

    return _load_widget


@pytest.fixture
def take_screenshot(page, screenshot_dir):
    """
    Fixture that provides a function to take screenshots.

    The screenshot is saved to the screenshots directory and can be
    read by AI for verification.
    """

    def _screenshot(name: str, full_page: bool = True):
        """
        Take a screenshot and save it.

        Args:
            name: Screenshot filename (without extension)
            full_page: Whether to capture full page or just viewport

        Returns:
            Path to the screenshot file
        """
        screenshot_path = screenshot_dir / f"{name}.png"
        page.screenshot(path=str(screenshot_path), full_page=full_page)
        return screenshot_path

    return _screenshot


@pytest.fixture
def wait_for_widget_render(page):
    """
    Fixture that provides a function to wait for widget rendering to complete.

    This waits for the simplified widget output to be rendered.
    """

    def _wait():
        """Wait for widget output to be rendered."""
        # Wait for widget output container to be present
        page.wait_for_selector('.tp-widget-output', timeout=5000)

        # Small additional delay for CSS rendering
        page.wait_for_timeout(100)

    return _wait
