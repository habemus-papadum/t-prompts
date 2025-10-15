"""Tests for format spec mini-language parsing."""

import t_prompts


def test_empty_format_spec_uses_expression():
    """Test that empty format spec uses expression as key."""
    value = "test"
    p = t_prompts.prompt(t"{value}")

    assert "value" in p
    node = p["value"]
    assert node.key == "value"
    assert node.render_hints == ""


def test_underscore_format_spec_uses_expression():
    """Test that underscore format spec uses expression as key."""
    my_var = "test"
    p = t_prompts.prompt(t"{my_var:_}")

    assert "my_var" in p
    node = p["my_var"]
    assert node.key == "my_var"
    assert node.render_hints == ""


def test_simple_format_spec_as_key():
    """Test that format spec without colon becomes the key."""
    value = "test"
    p = t_prompts.prompt(t"{value:custom_key}")

    assert "custom_key" in p
    node = p["custom_key"]
    assert node.key == "custom_key"
    assert node.render_hints == ""


def test_format_spec_with_colon_splits():
    """Test that colon in format spec splits key and hints."""
    value = "test"
    p = t_prompts.prompt(t"{value:my key:format=json}")

    assert "my key" in p
    node = p["my key"]
    assert node.key == "my key"
    assert node.render_hints == "format=json"


def test_format_spec_with_multiple_colons():
    """Test that multiple colons only split on first."""
    value = "test"
    p = t_prompts.prompt(t"{value:key:hint1:hint2:hint3}")

    assert "key" in p
    node = p["key"]
    assert node.key == "key"
    assert node.render_hints == "hint1:hint2:hint3"


def test_format_spec_with_spaces_in_key():
    """Test that internal spaces in key are preserved, but leading/trailing trimmed."""
    value = "test"
    p = t_prompts.prompt(t"{value: spaced key }")

    assert "spaced key" in p
    node = p["spaced key"]
    assert node.key == "spaced key"  # Leading/trailing trimmed, internal preserved
    assert node.render_hints == ""


def test_format_spec_with_colon_trims_key():
    """Test that key is trimmed when there's a colon delimiter."""
    value = "test"
    p = t_prompts.prompt(t"{value:  key  :hints}")

    assert "key" in p
    node = p["key"]
    assert node.key == "key"  # Trimmed
    assert node.render_hints == "hints"


def test_render_hints_not_applied_during_rendering():
    """Test that render hints are stored but not applied during rendering."""
    value = "test"
    p = t_prompts.prompt(t"{value:key:uppercase}")

    # Rendering should not change based on hints
    assert str(p) == "test"
    assert p.ir().text == "test"

    # But hints should be accessible
    node = p["key"]
    assert node.render_hints == "uppercase"


def test_format_spec_parsing_with_nested_prompts():
    """Test format spec parsing with nested prompts."""
    inner = "inner"
    p_inner = t_prompts.prompt(t"{inner:inner_key:hint1}")
    p_outer = t_prompts.prompt(t"{p_inner:outer_key:hint2}")

    assert "outer_key" in p_outer
    outer_node = p_outer["outer_key"]
    assert outer_node.render_hints == "hint2"

    assert "inner_key" in p_inner
    inner_node = p_inner["inner_key"]
    assert inner_node.render_hints == "hint1"


def test_empty_key_with_colon_delimiter():
    """Test that empty key before colon causes error."""
    value = "test"
    try:
        # This should fail because trimming the empty key results in empty string
        t_prompts.prompt(t"{value::hints}")
        assert False, "Should have raised EmptyExpressionError"
    except t_prompts.EmptyExpressionError:
        pass
