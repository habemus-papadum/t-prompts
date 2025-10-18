"""Tests for widget rendering HTML generation."""

import json

from t_prompts import prompt


def test_structured_prompt_has_repr_html():
    """Test that StructuredPrompt has _repr_html_() method."""
    task = "translate"
    p = prompt(t"Task: {task:t}")

    assert hasattr(p, "_repr_html_")
    assert callable(p._repr_html_)


def test_ir_has_repr_html():
    """Test that IntermediateRepresentation has _repr_html_() method."""
    task = "translate"
    p = prompt(t"Task: {task:t}")
    ir = p.ir()

    assert hasattr(ir, "_repr_html_")
    assert callable(ir._repr_html_)


def test_structured_prompt_repr_html_returns_html():
    """Test that _repr_html_() returns valid HTML string."""
    task = "translate"
    p = prompt(t"Task: {task:t}")

    html = p._repr_html_()

    assert isinstance(html, str)
    assert len(html) > 0
    # Should contain widget container
    assert "tp-widget-root" in html
    assert "data-tp-widget" in html


def test_ir_repr_html_returns_html():
    """Test that IntermediateRepresentation _repr_html_() returns valid HTML."""
    task = "translate"
    p = prompt(t"Task: {task:t}")
    ir = p.ir()

    html = ir._repr_html_()

    assert isinstance(html, str)
    assert len(html) > 0
    assert "tp-widget-root" in html
    assert "data-tp-widget" in html


def test_html_contains_embedded_json():
    """Test that HTML output contains embedded JSON data."""
    task = "translate"
    p = prompt(t"Task: {task:t}")

    html = p._repr_html_()

    # Should have script tag with JSON data
    assert '<script data-role="tp-widget-data"' in html
    assert "type=\"application/json\"" in html


def test_html_does_not_contain_javascript_bundle():
    """Test that widget HTML no longer includes JavaScript bundle."""
    task = "translate"
    p = prompt(t"Task: {task:t}")
    html = p._repr_html_()

    # Widget HTML should NOT include the bundle anymore
    assert "tp-widget-bundle" not in html
    assert "<script id=" not in html or '<script data-role="tp-widget-data"' in html


def test_html_contains_helper_message():
    """Test that widget HTML contains helper message for uninitalized state."""
    task = "translate"
    p = prompt(t"Task: {task:t}")
    html = p._repr_html_()

    # Should contain helper message
    assert "tp-widget-helper" in html
    assert "Widget not initialized" in html
    assert "setup_notebook()" in html


def test_html_contains_valid_json_data():
    """Test that embedded JSON can be parsed."""
    task = "translate"
    p = prompt(t"Task: {task:t}")

    html = p._repr_html_()

    # Extract JSON from script tag
    start = html.find('<script data-role="tp-widget-data"')
    if start != -1:
        start = html.find('>', start) + 1
        end = html.find('</script>', start)
        json_str = html[start:end]

        # Should be valid JSON
        data = json.loads(json_str)

        # Should have expected structure (combined compiled_ir, ir, source_prompt)
        assert "compiled_ir" in data
        assert "ir" in data
        assert "source_prompt" in data

        # Validate source_prompt structure
        assert "prompt_id" in data["source_prompt"]
        assert "children" in data["source_prompt"]

        # Validate ir structure
        assert "chunks" in data["ir"]
        assert "source_prompt_id" in data["ir"]
        assert "id" in data["ir"]

        # Validate compiled_ir structure
        assert "ir_id" in data["compiled_ir"]
        assert "subtree_map" in data["compiled_ir"]
        assert "num_elements" in data["compiled_ir"]


def test_nested_prompt_html():
    """Test HTML generation for nested prompts."""
    inner = prompt(t"Inner text")
    outer = prompt(t"Outer: {inner:i}")

    html = outer._repr_html_()

    assert isinstance(html, str)
    assert "tp-widget-root" in html

    # Extract and verify JSON structure
    start = html.find('<script data-role="tp-widget-data"')
    if start != -1:
        start = html.find('>', start) + 1
        end = html.find('</script>', start)
        json_str = html[start:end]
        data = json.loads(json_str)

        # Should have combined structure
        assert "source_prompt" in data
        assert "children" in data["source_prompt"]

        # Find the nested_prompt element in source_prompt
        for child in data["source_prompt"]["children"]:
            if child.get("type") == "nested_prompt":
                assert "children" in child
                assert "prompt_id" in child


def test_ir_html_contains_rendered_output():
    """Test that IR HTML includes chunks and source mapping."""
    task = "translate"
    p = prompt(t"Task: {task:t}")
    ir = p.ir()

    html = ir._repr_html_()

    # Extract JSON
    start = html.find('<script data-role="tp-widget-data"')
    if start != -1:
        start = html.find('>', start) + 1
        end = html.find('</script>', start)
        json_str = html[start:end]
        data = json.loads(json_str)

        # Should have combined structure
        assert "compiled_ir" in data
        assert "ir" in data
        assert "source_prompt" in data

        # Validate IR structure
        assert "chunks" in data["ir"]
        assert "source_prompt_id" in data["ir"]
        assert "id" in data["ir"]

        # Validate compiled_ir structure
        assert "ir_id" in data["compiled_ir"]
        assert "subtree_map" in data["compiled_ir"]

        # Validate source_prompt structure
        assert "prompt_id" in data["source_prompt"]
        assert "children" in data["source_prompt"]


def test_js_prelude_returns_script_tag():
    """Test that js_prelude() returns a script tag with the bundle."""
    from t_prompts import js_prelude

    prelude = js_prelude()

    assert isinstance(prelude, str)
    assert "<script" in prelude
    assert "tp-widget-bundle" in prelude
    assert "</script>" in prelude


def test_js_prelude_has_cache_busting():
    """Test that js_prelude() includes cache-busting hash in ID."""
    from t_prompts import js_prelude

    prelude = js_prelude()

    # Should have hash-based ID like "tp-widget-bundle-a1b2c3d4"
    assert 'id="tp-widget-bundle-' in prelude


def test_setup_notebook_returns_widget():
    """Test that setup_notebook() returns a Widget instance."""
    from t_prompts import setup_notebook
    from t_prompts.widgets import Widget

    widget = setup_notebook()

    assert isinstance(widget, Widget)


def test_setup_notebook_contains_js_prelude():
    """Test that setup_notebook() widget contains the JavaScript prelude."""
    from t_prompts import setup_notebook

    widget = setup_notebook()
    html = widget._repr_html_()

    assert isinstance(html, str)
    assert "<script" in html
    assert "tp-widget-bundle" in html
    assert "</script>" in html
