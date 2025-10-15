"""Visual tests for widget rendering using Playwright.

These tests use Playwright to render widgets in a real browser and take screenshots.
The AI can then read the screenshots to verify correct rendering.
"""

import pytest

from t_prompts import dedent, prompt


@pytest.mark.visual
def test_simple_prompt_renders(widget_page, take_screenshot, wait_for_widget_render, page):
    """Test that a simple prompt renders correctly."""
    task = "translate this to French"
    p = prompt(t"Task: {task:t}")

    # Load widget in browser
    widget_page(p, "simple_prompt.html", "Simple Prompt Test")
    wait_for_widget_render()

    # Take screenshot
    screenshot_path = take_screenshot("simple_prompt")

    # Verify widget container exists
    assert page.locator('[data-tp-widget]').count() > 0

    # Verify all three panes are present
    assert page.locator('.tp-pane-tree').count() > 0
    assert page.locator('.tp-pane-code').count() > 0
    assert page.locator('.tp-pane-preview').count() > 0

    # Screenshot saved for AI verification
    assert screenshot_path.exists()


@pytest.mark.visual
def test_nested_prompt_renders(widget_page, take_screenshot, wait_for_widget_render, page):
    """Test that nested prompts render correctly."""
    system_msg = prompt(t"You are a helpful AI assistant.")
    user_msg = "What is the capital of France?"
    conversation = prompt(t"System: {system_msg:sys}\nUser: {user_msg:usr}")

    widget_page(conversation, "nested_prompt.html", "Nested Prompt Test")
    wait_for_widget_render()

    screenshot_path = take_screenshot("nested_prompt")

    # Verify nested structure appears in tree
    tree_content = page.locator('.tp-tree').inner_text()
    assert "Nested" in tree_content

    assert screenshot_path.exists()


@pytest.mark.visual
def test_list_interpolation_renders(widget_page, take_screenshot, wait_for_widget_render, page):
    """Test that list interpolations render correctly."""
    examples = [
        prompt(t"Example 1: Simple addition"),
        prompt(t"Example 2: Complex multiplication"),
        prompt(t"Example 3: Division with remainder"),
    ]
    p = prompt(t"Here are some examples:\n{examples:ex:sep=\n\n}")

    widget_page(p, "list_prompt.html", "List Interpolation Test")
    wait_for_widget_render()

    screenshot_path = take_screenshot("list_interpolation")

    # Verify list structure in tree
    tree_content = page.locator('.tp-tree').inner_text()
    assert "List" in tree_content
    assert "3 items" in tree_content

    assert screenshot_path.exists()


@pytest.mark.visual
def test_multiline_dedented_prompt_renders(widget_page, take_screenshot, wait_for_widget_render, page):
    """Test that multi-line dedented prompts render correctly."""
    task = "summarize"
    topic = "climate change"
    p = dedent(t"""
        You are an expert writer.

        Task: {task:t}
        Topic: {topic:top}

        Please provide a detailed response.
    """)

    widget_page(p, "multiline_prompt.html", "Multi-line Prompt Test")
    wait_for_widget_render()

    screenshot_path = take_screenshot("multiline_dedented")

    # Verify code view shows multiple lines
    code_content = page.locator('.tp-code').inner_text()
    assert "You are an expert writer" in code_content
    assert "Task: summarize" in code_content
    assert "Topic: climate change" in code_content

    assert screenshot_path.exists()


@pytest.mark.visual
def test_render_hints_xml_wrapper(widget_page, take_screenshot, wait_for_widget_render, page):
    """Test that XML wrapper render hints work correctly."""
    content = "This content will be wrapped in XML tags."
    p = prompt(t"Content: {content:c:xml=document}")

    widget_page(p, "xml_wrapper.html", "XML Wrapper Test")
    wait_for_widget_render()

    screenshot_path = take_screenshot("xml_wrapper")

    # Verify tree shows the interpolation with xml hint
    tree_content = page.locator('.tp-tree').inner_text()
    assert "Interpolation" in tree_content

    assert screenshot_path.exists()


@pytest.mark.visual
def test_render_hints_markdown_header(widget_page, take_screenshot, wait_for_widget_render, page):
    """Test that markdown header render hints work correctly."""
    section = "This is the introduction section."
    p = prompt(t"{section:s:header=Introduction}")

    widget_page(p, "markdown_header.html", "Markdown Header Test")
    wait_for_widget_render()

    screenshot_path = take_screenshot("markdown_header")

    # Verify tree shows the interpolation
    tree_content = page.locator('.tp-tree').inner_text()
    assert "Interpolation" in tree_content

    assert screenshot_path.exists()


@pytest.mark.visual
@pytest.mark.skip(reason="IR widget rendering depends on toJSON() interface being redesigned")
def test_intermediate_representation_renders(widget_page, take_screenshot, wait_for_widget_render, page):
    """Test that IntermediateRepresentation renders correctly."""
    name = "Alice"
    age = "30"
    p = prompt(t"Name: {name:n}, Age: {age:a}")
    ir = p.ir()

    widget_page(ir, "intermediate_representation.html", "IR Test")
    wait_for_widget_render()

    screenshot_path = take_screenshot("intermediate_representation")

    # Verify code view shows rendered text
    code_content = page.locator('.tp-code').inner_text()
    assert "Name: Alice" in code_content
    assert "Age: 30" in code_content

    # Verify preview pane exists
    assert page.locator('.tp-preview').count() > 0

    assert screenshot_path.exists()


@pytest.mark.visual
def test_markdown_preview_renders(widget_page, take_screenshot, wait_for_widget_render, page):
    """Test that Markdown preview renders correctly."""
    content = """
# Heading 1

This is a **bold** and *italic* text.

## Heading 2

- List item 1
- List item 2
- List item 3

```python
def example():
    return "code block"
```
"""
    p = prompt(t"{content:c}")

    widget_page(p, "markdown_preview.html", "Markdown Preview Test")
    wait_for_widget_render()

    screenshot_path = take_screenshot("markdown_preview")

    # Verify preview pane has rendered HTML
    preview_html = page.locator('.tp-preview').inner_html()
    assert "<h1>" in preview_html
    assert "<h2>" in preview_html
    assert "<strong>" in preview_html or "<b>" in preview_html
    assert "<em>" in preview_html or "<i>" in preview_html
    assert "<ul>" in preview_html
    assert "code" in preview_html.lower()  # Check for code elements (may have class attributes)

    assert screenshot_path.exists()


@pytest.mark.visual
def test_katex_math_renders(widget_page, take_screenshot, wait_for_widget_render, page):
    """Test that KaTeX math rendering works correctly."""
    formula = "The quadratic formula is: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$"
    p = prompt(t"{formula:f}")

    widget_page(p, "katex_math.html", "KaTeX Math Test")
    wait_for_widget_render()

    screenshot_path = take_screenshot("katex_math")

    # Verify preview has KaTeX rendered elements
    preview_html = page.locator('.tp-preview').inner_html()
    # KaTeX adds specific classes to math elements
    assert "katex" in preview_html or "math" in preview_html

    assert screenshot_path.exists()


@pytest.mark.visual
def test_complex_nested_structure(widget_page, take_screenshot, wait_for_widget_render, page):
    """Test deeply nested prompts with multiple levels."""
    role = "teacher"
    inner = prompt(t"Role: {role:r}")
    middle = prompt(t"Context: {inner:ctx}")
    outer = prompt(t"System: {middle:sys}")

    widget_page(outer, "complex_nested.html", "Complex Nested Test")
    wait_for_widget_render()

    screenshot_path = take_screenshot("complex_nested")

    # Verify multiple nesting levels in tree
    tree_content = page.locator('.tp-tree').inner_text()
    assert tree_content.count("Nested") >= 2  # Should have multiple nested levels

    assert screenshot_path.exists()


@pytest.mark.visual
def test_combined_features(widget_page, take_screenshot, wait_for_widget_render, page):
    """Test a realistic prompt with multiple features combined."""
    system = prompt(t"You are a helpful assistant specialized in mathematics.")
    examples = [
        prompt(t"Q: What is 2+2?\nA: 4"),
        prompt(t"Q: What is 5*3?\nA: 15"),
    ]
    question = "What is the derivative of x^2?"

    p = dedent(t"""
        {system:sys:xml=system}

        {examples:ex:header=Examples:sep=\n\n}

        Question: {question:q}
    """)

    widget_page(p, "combined_features.html", "Combined Features Test")
    wait_for_widget_render()

    screenshot_path = take_screenshot("combined_features")

    # Verify all components are present
    tree_content = page.locator('.tp-tree').inner_text()
    assert "List" in tree_content
    assert "Interpolation" in tree_content

    code_content = page.locator('.tp-code').inner_text()
    assert "mathematics" in code_content
    assert "derivative" in code_content

    assert screenshot_path.exists()


@pytest.mark.visual
def test_widget_layout_structure(widget_page, take_screenshot, wait_for_widget_render, page):
    """Test that the three-pane layout structure is correct."""
    p = prompt(t"Simple test prompt")

    widget_page(p, "layout_test.html", "Layout Structure Test")
    wait_for_widget_render()

    screenshot_path = take_screenshot("widget_layout")

    # Verify all pane headers
    assert page.locator('h4:has-text("Structure")').count() > 0
    assert page.locator('h4:has-text("Code View")').count() > 0
    assert page.locator('h4:has-text("Preview")').count() > 0

    # Verify widget container uses grid layout
    widget_container = page.locator('.tp-widget-container')
    assert widget_container.count() > 0

    assert screenshot_path.exists()


@pytest.mark.visual
def test_empty_prompt_renders(widget_page, take_screenshot, wait_for_widget_render, page):
    """Test that an empty prompt renders without errors."""
    p = prompt(t"")

    widget_page(p, "empty_prompt.html", "Empty Prompt Test")
    wait_for_widget_render()

    screenshot_path = take_screenshot("empty_prompt")

    # Should still have all panes even if empty
    assert page.locator('.tp-pane-tree').count() > 0
    assert page.locator('.tp-pane-code').count() > 0
    assert page.locator('.tp-pane-preview').count() > 0

    assert screenshot_path.exists()


@pytest.mark.visual
def test_source_location_display(widget_page, take_screenshot, wait_for_widget_render, page):
    """Test that source location information is captured correctly."""
    value = "test"
    p = prompt(t"Value: {value:v}")

    widget_page(p, "source_location.html", "Source Location Test")
    wait_for_widget_render()

    screenshot_path = take_screenshot("source_location")

    # Verify widget renders (source location is embedded in JSON)
    assert page.locator('[data-tp-widget]').count() > 0

    assert screenshot_path.exists()
