"""Tests for rendering behavior."""

import t_prompts


def test_render_matches_fstring_behavior():
    """Test that str(prompt(t"...")) matches f-string rendering."""
    name = "Alice"
    age = "30"

    p = t_prompts.prompt(t"Name: {name}, Age: {age}")

    # Should match f-string behavior
    expected = f"Name: {name}, Age: {age}"
    assert str(p) == expected
    assert p.ir().text == expected


def test_render_format_spec_as_key():
    """Test that format specs are used as keys, not for formatting."""
    num = "42"

    # "05d" is used as a key, not as a format spec
    p = t_prompts.prompt(t"{num:05d}")

    # Should NOT format as "00042" - format spec is only used as key
    assert str(p) == "42"
    assert p.ir().text == "42"
    assert "05d" in p  # Key is the format spec


def test_nested_prompt_rendering():
    """Test that nested prompts render recursively."""
    inner_text = "inner"
    outer_text = "outer"

    p_inner = t_prompts.prompt(t"[{inner_text:inner}]")
    p_outer = t_prompts.prompt(t"{outer_text:outer} {p_inner:nested}")

    assert str(p_inner) == "[inner]"
    assert str(p_outer) == "outer [inner]"


def test_render_with_conversions():
    """Test that conversions are always applied during rendering."""
    text = "hello"
    text2 = "world"

    p = t_prompts.prompt(t"{text!r:t1} {text2!s:t2}")

    # !r should give 'hello', !s should give world
    assert str(p) == "'hello' world"


def test_render_conversion_with_nested():
    """Test that conversions work with nested prompts."""
    inner = "inner"
    p_inner = t_prompts.prompt(t"{inner:i}")

    # Apply !s conversion to the nested prompt
    p_outer = t_prompts.prompt(t"{p_inner!s:nested}")

    # !s of a StructuredPrompt should call str() on it
    assert "inner" in str(p_outer)


def test_str_dunder_method():
    """Test that __str__() is equivalent to render().text."""
    x = "X"
    p = t_prompts.prompt(t"{x:x}")

    assert str(p) == p.ir().text
    assert p.__str__() == p.ir().text


def test_interpolation_render_method():
    """Test that TextInterpolation.ir() works correctly."""
    x = "X"
    p = t_prompts.prompt(t"{x:x}")

    node = p["x"]
    assert node.ir().text == "X"


def test_interpolation_render_with_conversion():
    """Test that TextInterpolation.ir() applies conversions."""
    text = "hello"
    p = t_prompts.prompt(t"{text!r:t}")

    node = p["t"]
    assert node.ir().text == "'hello'"


def test_interpolation_render_nested():
    """Test that StructuredPrompt.ir() works with nested prompts."""
    inner = "inner"
    p_inner = t_prompts.prompt(t"{inner:i}")
    p_outer = t_prompts.prompt(t"{p_inner:p}")

    node = p_outer["p"]
    rendered = node.ir()
    # node.ir() returns IntermediateRepresentation for nested prompts
    assert rendered.text == "inner"


def test_render_preserves_string_segments():
    """Test that all string segments are preserved during rendering."""
    a = "A"
    b = "B"

    p = t_prompts.prompt(t"prefix {a:a} middle {b:b} suffix")

    assert str(p) == "prefix A middle B suffix"


def test_render_empty_prompt():
    """Test rendering a prompt with no interpolations."""
    p = t_prompts.prompt(t"just text, no interpolations")

    assert str(p) == "just text, no interpolations"
    assert len(p) == 0


def test_render_multiple_nested_levels():
    """Test rendering with 3 levels of nesting."""
    a = "A"
    p1 = t_prompts.prompt(t"{a:a}")
    p2 = t_prompts.prompt(t"[{p1:p1}]")
    p3 = t_prompts.prompt(t"<{p2:p2}>")

    assert str(p3) == "<[A]>"


def test_render_with_empty_strings():
    """Test rendering when there are empty string segments."""
    a = "A"
    b = "B"

    # Template starts and ends with interpolations
    p = t_prompts.prompt(t"{a:a}{b:b}")

    assert str(p) == "AB"


def test_render_consistency():
    """Test that render() is consistent across multiple calls."""
    x = "X"
    p = t_prompts.prompt(t"{x:x}")

    result1 = p.ir().text
    result2 = p.ir().text
    result3 = str(p)

    assert result1 == result2 == result3
