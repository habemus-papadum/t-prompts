"""Simple wrap indicator test with obvious wrapping."""

from pathlib import Path

from playwright.sync_api import sync_playwright

from t_prompts import prompt
from t_prompts.widget_export import save_widget_html

# Create a simple prompt with very long lines to guarantee wrapping
p = prompt(t"""AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC

Short line here.

DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
""")

# Save to HTML
output_dir = Path(__file__).parent / "temp_output"
output_dir.mkdir(exist_ok=True)
html_path = save_widget_html(p, output_dir / "wrap_simple.html", "Simple Wrap Test")

print(f"✅ Saved widget to: {html_path}")

# Take screenshot with Playwright
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1200, "height": 600})

    page.goto(f"file://{html_path}")
    page.wait_for_selector('[data-tp-widget]', state='visible', timeout=5000)
    page.wait_for_timeout(500)

    screenshot_path = output_dir / "wrap_simple_screenshot.png"
    page.screenshot(path=str(screenshot_path), full_page=True)

    # Count wrap indicators
    wrapped_count = page.locator('.tp-wrapped-line').count()
    print(f"✅ Found {wrapped_count} wrap indicators")

    browser.close()

print(f"✅ Screenshot saved to: {screenshot_path}")
print("\n📄 Files created:")
print(f"   - HTML: {html_path}")
print(f"   - Screenshot: {screenshot_path}")
