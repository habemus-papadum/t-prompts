"""Temporary script to test wrap indicators visually."""

from pathlib import Path

from playwright.sync_api import sync_playwright

from t_prompts import prompt
from t_prompts.widget_export import save_widget_html

# Create a prompt with long text that should wrap
# Using multiple long strings to ensure wrapping at different points
long_text = (
    "This is a very long piece of text that should definitely wrap when displayed "
    "in the widget viewer because it exceeds the typical character width of a monospace display."
)

items = [
    (
        "First item with a moderate amount of text that may or may not wrap "
        "depending on the viewport size and font settings used"
    ),
    "Second item",
    (
        "Third item containing an extraordinarily long sentence that goes on and on "
        "without any breaks to force wrapping behavior"
    ),
]

p = prompt(t"""
Task: {long_text:t}

Items to process:
{[prompt(t"- {item:i}") for item in items]:inline:sep=\n}

This is another paragraph with substantial content that will likely wrap to demonstrate the wrap indicators in action.
""")

# Save to HTML file
output_dir = Path(__file__).parent / "temp_output"
output_dir.mkdir(exist_ok=True)
html_path = save_widget_html(p, output_dir / "wrap_test.html", "Wrap Indicator Test")

print(f"Saved widget to: {html_path}")

# Open with Playwright and take a screenshot
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1200, "height": 800})

    # Load the HTML file
    page.goto(f"file://{html_path}")

    # Wait for widget to render
    page.wait_for_selector('[data-tp-widget]', state='visible', timeout=5000)
    page.wait_for_timeout(500)  # Extra time for wrap detection

    # Take screenshot
    screenshot_path = output_dir / "wrap_test_screenshot.png"
    page.screenshot(path=str(screenshot_path), full_page=True)

    print(f"Screenshot saved to: {screenshot_path}")

    # Read and analyze the screenshot
    print("\n=== Visual Inspection ===")
    print("Looking at the rendered widget to verify wrap indicators...")

    # Get all spans with wrap indicators
    wrapped_spans = page.locator('.tp-wrapped-line').all()
    print(f"\nFound {len(wrapped_spans)} spans with wrap indicators")

    # Get their text content to see what's wrapping
    if wrapped_spans:
        print("\nSpans marked as wrapped:")
        for i, span in enumerate(wrapped_spans[:5]):  # Show first 5
            text = span.text_content()
            # Truncate if too long
            display_text = text[:50] + "..." if len(text) > 50 else text
            print(f"  {i+1}. '{display_text}'")

    browser.close()

print(f"\n✅ Test complete! Check the screenshot at: {screenshot_path}")
print(f"   Also view the HTML file at: {html_path}")
