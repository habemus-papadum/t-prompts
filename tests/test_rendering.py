"""Tests for rendering behavior."""

import structured_prompts


def test_render_matches_fstring_behavior():
    """Test that str(prompt(t"...")) matches f-string rendering."""
    name = "Alice"
    age = "30"

    p = structured_prompts.prompt(t"Name: {name}, Age: {age}")

    # Should match f-string behavior
    expected = f"Name: {name}, Age: {age}"
    assert str(p) == expected
    assert p.render() == expected


def test_render_without_apply_format_spec():
    """Test that format specs are ignored by default (used as keys)."""
    num = "42"

    # "05d" is used as a key, not as a format spec
    p = structured_prompts.prompt(t"{num:05d}")

    # Should NOT format as "00042"
    assert str(p) == "42"
    assert p.render() == "42"


def test_render_with_apply_format_spec_true():
    """Test that apply_format_spec=True applies valid format specs."""
    num = "42"

    # This time we use a format spec that looks like formatting
    # Since we're using a string value, format(str, spec) should work
    p = structured_prompts.prompt(t"{num:>5}")

    # Without apply_format_spec, format spec is ignored
    assert p.render() == "42"

    # With apply_format_spec=True, should right-align
    assert p.render(apply_format_spec=True) == "   42"


def test_render_apply_format_spec_with_invalid_spec():
    """Test that invalid format specs are gracefully ignored."""
    text = "hello"

    # "key" looks like a key label, not a format spec
    p = structured_prompts.prompt(t"{text:key}")

    # Even with apply_format_spec=True, this shouldn't try to format
    assert p.render(apply_format_spec=True) == "hello"


def test_render_apply_format_spec_with_error():
    """Test that format errors are caught and ignored."""
    text = "hello"

    # Use a format spec that would cause an error for strings
    # For example, "d" (decimal) doesn't work with strings
    p = structured_prompts.prompt(t"{text:.2f}")

    # Without apply_format_spec, renders normally
    assert p.render() == "hello"

    # With apply_format_spec, the error should be caught and ignored
    assert p.render(apply_format_spec=True) == "hello"


def test_nested_prompt_rendering():
    """Test that nested prompts render recursively."""
    inner_text = "inner"
    outer_text = "outer"

    p_inner = structured_prompts.prompt(t"[{inner_text:inner}]")
    p_outer = structured_prompts.prompt(t"{outer_text:outer} {p_inner:nested}")

    assert str(p_inner) == "[inner]"
    assert str(p_outer) == "outer [inner]"


def test_nested_prompt_rendering_with_apply_format_spec():
    """Test that apply_format_spec propagates to nested prompts."""
    num = "42"

    p_inner = structured_prompts.prompt(t"{num:>5}")
    p_outer = structured_prompts.prompt(t"Value: {p_inner:inner}")

    # Without apply_format_spec
    assert p_outer.render() == "Value: 42"

    # With apply_format_spec (should propagate to nested)
    assert p_outer.render(apply_format_spec=True) == "Value:    42"


def test_render_with_conversions():
    """Test that conversions are always applied during rendering."""
    text = "hello"
    text2 = "world"

    p = structured_prompts.prompt(t"{text!r:t1} {text2!s:t2}")

    # !r should give 'hello', !s should give world
    assert str(p) == "'hello' world"


def test_render_conversion_with_nested():
    """Test that conversions work with nested prompts."""
    inner = "inner"
    p_inner = structured_prompts.prompt(t"{inner:i}")

    # Apply !s conversion to the nested prompt
    p_outer = structured_prompts.prompt(t"{p_inner!s:nested}")

    # !s of a StructuredPrompt should call str() on it
    assert "inner" in str(p_outer)


def test_str_dunder_method():
    """Test that __str__() is equivalent to render()."""
    x = "X"
    p = structured_prompts.prompt(t"{x:x}")

    assert str(p) == p.render()
    assert p.__str__() == p.render()


def test_interpolation_render_method():
    """Test that StructuredInterpolation.render() works correctly."""
    x = "X"
    p = structured_prompts.prompt(t"{x:x}")

    node = p["x"]
    assert node.render() == "X"


def test_interpolation_render_with_conversion():
    """Test that StructuredInterpolation.render() applies conversions."""
    text = "hello"
    p = structured_prompts.prompt(t"{text!r:t}")

    node = p["t"]
    assert node.render() == "'hello'"


def test_interpolation_render_nested():
    """Test that StructuredInterpolation.render() works with nested prompts."""
    inner = "inner"
    p_inner = structured_prompts.prompt(t"{inner:i}")
    p_outer = structured_prompts.prompt(t"{p_inner:p}")

    node = p_outer["p"]
    assert node.render() == "inner"


def test_render_preserves_string_segments():
    """Test that all string segments are preserved during rendering."""
    a = "A"
    b = "B"

    p = structured_prompts.prompt(t"prefix {a:a} middle {b:b} suffix")

    assert str(p) == "prefix A middle B suffix"


def test_render_empty_prompt():
    """Test rendering a prompt with no interpolations."""
    p = structured_prompts.prompt(t"just text, no interpolations")

    assert str(p) == "just text, no interpolations"
    assert len(p) == 0


def test_render_multiple_nested_levels():
    """Test rendering with 3 levels of nesting."""
    a = "A"
    p1 = structured_prompts.prompt(t"{a:a}")
    p2 = structured_prompts.prompt(t"[{p1:p1}]")
    p3 = structured_prompts.prompt(t"<{p2:p2}>")

    assert str(p3) == "<[A]>"


def test_render_with_empty_strings():
    """Test rendering when there are empty string segments."""
    a = "A"
    b = "B"

    # Template starts and ends with interpolations
    p = structured_prompts.prompt(t"{a:a}{b:b}")

    assert str(p) == "AB"


def test_render_consistency():
    """Test that render() is consistent across multiple calls."""
    x = "X"
    p = structured_prompts.prompt(t"{x:x}")

    result1 = p.render()
    result2 = p.render()
    result3 = str(p)

    assert result1 == result2 == result3
