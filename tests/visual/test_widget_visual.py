"""Visual tests for widget rendering using Playwright.

These tests use Playwright to render widgets in a real browser and take screenshots.
The AI can then read the screenshots to verify correct rendering.
"""

import pytest

from t_prompts import prompt


@pytest.mark.visual
def test_simple_widget_renders(widget_page, take_screenshot, wait_for_widget_render, page):
    """Test that a simple prompt renders correctly in the widget."""
    task = "translate this to French"
    p = prompt(t"Task: {task:t}")

    # Load widget in browser
    widget_page(p, "simple_prompt.html", "Simple Prompt Test")
    wait_for_widget_render()

    # Take screenshot
    screenshot_path = take_screenshot("simple_prompt")

    # Verify widget container exists
    assert page.locator('[data-tp-widget]').count() > 0

    # Verify widget output is present
    assert page.locator('.tp-widget-output').count() > 0

    # Screenshot saved for AI verification
    assert screenshot_path.exists()
