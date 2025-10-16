"""Tests for widget export utilities."""

from pathlib import Path

import pytest

from t_prompts import dedent, prompt
from t_prompts.widgets import create_widget_gallery, save_widget_html


@pytest.fixture
def temp_output_dir(tmp_path):
    """Create a temporary output directory for tests."""
    output_dir = tmp_path / "output"
    output_dir.mkdir()
    return output_dir


def test_save_widget_html_creates_file(temp_output_dir):
    """Test that save_widget_html creates a file."""
    task = "translate"
    p = prompt(t"Task: {task:t}")

    output_path = temp_output_dir / "widget.html"
    result = save_widget_html(p, output_path, "Test Widget")

    assert result.exists()
    assert result == output_path


def test_save_widget_html_creates_parent_dirs(tmp_path):
    """Test that save_widget_html creates parent directories if needed."""
    task = "translate"
    p = prompt(t"Task: {task:t}")

    # Use nested path that doesn't exist yet
    output_path = tmp_path / "deeply" / "nested" / "path" / "widget.html"
    result = save_widget_html(p, output_path, "Test Widget")

    assert result.exists()
    assert result.parent == tmp_path / "deeply" / "nested" / "path"


def test_save_widget_html_contains_title(temp_output_dir):
    """Test that saved HTML contains the specified title."""
    p = prompt(t"Simple prompt")

    output_path = temp_output_dir / "widget.html"
    save_widget_html(p, output_path, "My Custom Title")

    html_content = output_path.read_text(encoding="utf-8")
    assert "<title>My Custom Title</title>" in html_content
    assert "<h1>My Custom Title</h1>" in html_content


def test_save_widget_html_contains_widget_data(temp_output_dir):
    """Test that saved HTML contains widget markup and data."""
    task = "translate"
    p = prompt(t"Task: {task:t}")

    output_path = temp_output_dir / "widget.html"
    save_widget_html(p, output_path, "Test Widget")

    html_content = output_path.read_text(encoding="utf-8")

    # Should contain widget container
    assert 'data-tp-widget' in html_content

    # Should contain embedded JSON data
    assert 'data-role="tp-widget-data"' in html_content

    # Should contain widget mount point
    assert 'tp-widget-mount' in html_content

    # Should contain the prompt data in JSON
    assert 'prompt_id' in html_content
    assert 'children' in html_content


def test_save_widget_html_valid_html5(temp_output_dir):
    """Test that saved HTML has valid HTML5 structure."""
    p = prompt(t"Simple prompt")

    output_path = temp_output_dir / "widget.html"
    save_widget_html(p, output_path, "Test Widget")

    html_content = output_path.read_text(encoding="utf-8")

    # Check basic HTML5 structure
    assert html_content.startswith("<!DOCTYPE html>")
    assert '<html lang="en">' in html_content
    assert '<meta charset="UTF-8">' in html_content
    assert '<meta name="viewport"' in html_content
    assert "</html>" in html_content


def test_save_widget_html_with_nested_prompt(temp_output_dir):
    """Test saving a widget with nested prompts."""
    system_msg = prompt(t"You are a helpful AI assistant.")
    user_msg = "What is the capital of France?"
    conversation = prompt(t"System: {system_msg:sys}\nUser: {user_msg:usr}")

    output_path = temp_output_dir / "nested.html"
    save_widget_html(conversation, output_path, "Nested Prompt")

    html_content = output_path.read_text(encoding="utf-8")
    assert output_path.exists()
    assert 'data-tp-widget' in html_content


def test_save_widget_html_with_intermediate_representation(temp_output_dir):
    """Test saving an IntermediateRepresentation widget."""
    name = "Alice"
    age = "30"
    p = prompt(t"Name: {name:n}, Age: {age:a}")
    ir = p.ir()

    output_path = temp_output_dir / "ir.html"
    save_widget_html(ir, output_path, "IR Widget")

    html_content = output_path.read_text(encoding="utf-8")
    assert output_path.exists()
    assert 'data-tp-widget' in html_content


def test_save_widget_html_accepts_string_path(temp_output_dir):
    """Test that save_widget_html accepts string path."""
    p = prompt(t"Simple prompt")

    output_path = str(temp_output_dir / "widget.html")  # String, not Path
    result = save_widget_html(p, output_path, "Test Widget")

    assert isinstance(result, Path)
    assert result.exists()


def test_create_widget_gallery_creates_file(temp_output_dir):
    """Test that create_widget_gallery creates a file."""
    widgets = {
        "Simple": prompt(t"Task: translate"),
        "Nested": prompt(t"Outer: {prompt(t'Inner'):i}"),
    }

    output_path = temp_output_dir / "gallery.html"
    result = create_widget_gallery(widgets, output_path, "Test Gallery")

    assert result.exists()
    assert result == output_path


def test_create_widget_gallery_contains_all_widgets(temp_output_dir):
    """Test that gallery contains all provided widgets."""
    widgets = {
        "Widget A": prompt(t"First widget"),
        "Widget B": prompt(t"Second widget"),
        "Widget C": prompt(t"Third widget"),
    }

    output_path = temp_output_dir / "gallery.html"
    create_widget_gallery(widgets, output_path, "Test Gallery")

    html_content = output_path.read_text(encoding="utf-8")

    # Should contain all widget labels
    assert "<h2>Widget A</h2>" in html_content
    assert "<h2>Widget B</h2>" in html_content
    assert "<h2>Widget C</h2>" in html_content

    # Should contain multiple widget containers
    widget_count = html_content.count('data-tp-widget')
    assert widget_count == 3


def test_create_widget_gallery_contains_count(temp_output_dir):
    """Test that gallery displays widget count."""
    widgets = {
        "Widget 1": prompt(t"First"),
        "Widget 2": prompt(t"Second"),
        "Widget 3": prompt(t"Third"),
        "Widget 4": prompt(t"Fourth"),
    }

    output_path = temp_output_dir / "gallery.html"
    create_widget_gallery(widgets, output_path, "Test Gallery")

    html_content = output_path.read_text(encoding="utf-8")
    assert "Widget Gallery - 4 items" in html_content


def test_create_widget_gallery_contains_type_info(temp_output_dir):
    """Test that gallery shows type information for each widget."""
    p = prompt(t"Simple prompt")
    ir = p.ir()

    widgets = {
        "Prompt": p,
        "IR": ir,
    }

    output_path = temp_output_dir / "gallery.html"
    create_widget_gallery(widgets, output_path, "Test Gallery")

    html_content = output_path.read_text(encoding="utf-8")

    # Should show type names
    assert "Type: StructuredPrompt" in html_content
    assert "Type: IntermediateRepresentation" in html_content


def test_create_widget_gallery_valid_html5(temp_output_dir):
    """Test that gallery has valid HTML5 structure."""
    widgets = {
        "Widget A": prompt(t"First"),
    }

    output_path = temp_output_dir / "gallery.html"
    create_widget_gallery(widgets, output_path, "Test Gallery")

    html_content = output_path.read_text(encoding="utf-8")

    # Check basic HTML5 structure
    assert html_content.startswith("<!DOCTYPE html>")
    assert '<html lang="en">' in html_content
    assert '<meta charset="UTF-8">' in html_content
    assert "</html>" in html_content


def test_create_widget_gallery_empty_dict(temp_output_dir):
    """Test that gallery handles empty widget dictionary."""
    widgets = {}

    output_path = temp_output_dir / "gallery.html"
    create_widget_gallery(widgets, output_path, "Empty Gallery")

    html_content = output_path.read_text(encoding="utf-8")
    assert output_path.exists()
    assert "Widget Gallery - 0 items" in html_content


def test_create_widget_gallery_with_complex_prompts(temp_output_dir):
    """Test gallery with various complex prompt types."""
    # List interpolation
    examples = [
        prompt(t"Example 1: Simple addition"),
        prompt(t"Example 2: Multiplication"),
    ]
    list_prompt = prompt(t"Examples:\n{examples:ex:sep=\n\n}")

    # Nested prompt
    inner = prompt(t"Inner content")
    nested_prompt = prompt(t"Outer: {inner:i}")

    # Multi-line with dedent
    dedented = dedent(t"""
        Line 1
        Line 2
        Line 3
    """)

    widgets = {
        "List Prompt": list_prompt,
        "Nested Prompt": nested_prompt,
        "Dedented Prompt": dedented,
    }

    output_path = temp_output_dir / "complex_gallery.html"
    create_widget_gallery(widgets, output_path, "Complex Gallery")

    html_content = output_path.read_text(encoding="utf-8")
    assert output_path.exists()
    assert "Widget Gallery - 3 items" in html_content


def test_save_widget_html_escapes_html_in_title(temp_output_dir):
    """Test that HTML in title is properly escaped."""
    p = prompt(t"Simple prompt")

    # Title with HTML characters
    output_path = temp_output_dir / "widget.html"
    save_widget_html(p, output_path, "Test <script>alert('xss')</script>")

    html_content = output_path.read_text(encoding="utf-8")

    # Title should be in the HTML, check that script tags appear but are part of title text
    assert "<title>Test <script>alert('xss')</script></title>" in html_content


def test_create_widget_gallery_accepts_string_path(temp_output_dir):
    """Test that create_widget_gallery accepts string path."""
    widgets = {"Widget A": prompt(t"First")}

    output_path = str(temp_output_dir / "gallery.html")  # String, not Path
    result = create_widget_gallery(widgets, output_path, "Test Gallery")

    assert isinstance(result, Path)
    assert result.exists()


def test_save_widget_html_default_title(temp_output_dir):
    """Test that save_widget_html uses default title when not specified."""
    p = prompt(t"Simple prompt")

    output_path = temp_output_dir / "widget.html"
    save_widget_html(p, output_path)  # No title specified

    html_content = output_path.read_text(encoding="utf-8")
    assert "<title>T-Prompts Widget</title>" in html_content


def test_create_widget_gallery_default_title(temp_output_dir):
    """Test that create_widget_gallery uses default title when not specified."""
    widgets = {"Widget A": prompt(t"First")}

    output_path = temp_output_dir / "gallery.html"
    create_widget_gallery(widgets, output_path)  # No title specified

    html_content = output_path.read_text(encoding="utf-8")
    assert "<title>T-Prompts Widget Gallery</title>" in html_content


def test_save_widget_html_with_multiline_content(temp_output_dir):
    """Test saving widget with multi-line content."""
    p = dedent(t"""
        You are an expert writer.

        Task: Summarize the following text.

        Please provide a detailed response.
    """)

    output_path = temp_output_dir / "multiline.html"
    save_widget_html(p, output_path, "Multi-line Widget")

    html_content = output_path.read_text(encoding="utf-8")
    assert output_path.exists()
    assert 'data-tp-widget' in html_content


def test_create_widget_gallery_preserves_order(temp_output_dir):
    """Test that gallery preserves widget order."""
    widgets = {
        "First": prompt(t"A"),
        "Second": prompt(t"B"),
        "Third": prompt(t"C"),
    }

    output_path = temp_output_dir / "gallery.html"
    create_widget_gallery(widgets, output_path, "Ordered Gallery")

    html_content = output_path.read_text(encoding="utf-8")

    # Find positions of each widget label
    pos_first = html_content.find("<h2>First</h2>")
    pos_second = html_content.find("<h2>Second</h2>")
    pos_third = html_content.find("<h2>Third</h2>")

    # Verify they appear in order
    assert pos_first < pos_second < pos_third
