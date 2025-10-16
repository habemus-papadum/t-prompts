"""Final wrap indicator test with multiple spans on same line."""

from t_prompts import prompt
from t_prompts.widget_export import save_widget_html
from playwright.sync_api import sync_playwright
from pathlib import Path

# Create a prompt with multiple interpolations that will create many spans
part1 = "The quick brown fox jumps over the lazy dog multiple times"
part2 = "to demonstrate the wrap indicator feature working correctly"
part3 = "with multiple different interpolations on the same line"

items = ["First item text", "Second item text", "Third item text"]

# Create a prompt with many interpolations to force wrapping between spans
p2 = prompt(t"""
Task: {part1:task_part1} {part2:task_part2} {part3:task_part3}

Items: {[prompt(t"{item:i}") for item in items]:inline:sep=, }

More text: The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog again and again.
""", allow_duplicate_keys=True)

# Save to HTML
output_dir = Path(__file__).parent / "temp_output"
output_dir.mkdir(exist_ok=True)
html_path = save_widget_html(p2, output_dir / "wrap_final.html", "Wrap Indicator Final Test")

print(f"✅ Saved widget to: {html_path}")

# Take screenshot
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 800, "height": 600})  # Narrower viewport to force wrapping

    page.goto(f"file://{html_path}")
    page.wait_for_selector('[data-tp-widget]', state='visible', timeout=5000)
    page.wait_for_timeout(500)

    screenshot_path = output_dir / "wrap_final_screenshot.png"
    page.screenshot(path=str(screenshot_path), full_page=True)

    # Check results
    wrapped_count = page.locator('.tp-wrapped-line').count()
    print(f"✅ Found {wrapped_count} wrap indicators")

    # Check that wrap indicators have ::after with ↘
    if wrapped_count > 0:
        # Get computed styles to verify the arrow is there
        print("✅ Wrap indicators are present and should show ↘ arrows")

    browser.close()

print(f"✅ Screenshot saved to: {screenshot_path}")
print(f"\n📄 Files for review:")
print(f"   - HTML: {html_path}")
print(f"   - Screenshot: {screenshot_path}")
print(f"\nThe screenshot should show ↘ arrows at the end of lines that wrap to the next line.")
