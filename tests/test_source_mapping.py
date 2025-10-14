"""Tests for source mapping functionality."""

import t_prompts


def test_rendered_prompt_basic():
    """Test that render returns RenderedPrompt."""
    value = "test"
    p = t_prompts.prompt(t"Value: {value:v}")

    rendered = p.render()

    assert isinstance(rendered, t_prompts.RenderedPrompt)
    assert rendered.text == "Value: test"
    assert rendered.source_prompt is p


def test_source_map_single_interpolation():
    """Test source map for single interpolation."""
    value = "test"
    p = t_prompts.prompt(t"Value: {value:v}")

    rendered = p.render()

    assert len(rendered.source_map) == 1
    span = rendered.source_map[0]

    assert span.start == 7  # After "Value: "
    assert span.end == 11  # After "test"
    assert span.key == "v"
    assert span.path == ()


def test_source_map_multiple_interpolations():
    """Test source map for multiple interpolations."""
    name = "Alice"
    age = "30"
    p = t_prompts.prompt(t"Name: {name:n}, Age: {age:a}")

    rendered = p.render()

    assert len(rendered.source_map) == 2

    # First span for name
    span1 = rendered.source_map[0]
    assert span1.start == 6  # After "Name: "
    assert span1.end == 11  # After "Alice"
    assert span1.key == "n"

    # Second span for age
    span2 = rendered.source_map[1]
    # Text is: "Name: Alice, Age: 30"
    # Position: 0123456789012345678901
    # Alice ends at 11, ", Age: " is 7 chars, so 30 starts at 18
    assert span2.start == 18  # After ", Age: "
    assert span2.end == 20  # After "30"
    assert span2.key == "a"


def test_get_span_at_position():
    """Test get_span_at to find span at a position."""
    name = "Alice"
    age = "30"
    p = t_prompts.prompt(t"Name: {name:n}, Age: {age:a}")

    rendered = p.render()

    # Position 8 should be in the "name" span
    span = rendered.get_span_at(8)
    assert span is not None
    assert span.key == "n"

    # Position 18 should be in the "age" span
    span = rendered.get_span_at(18)
    assert span is not None
    assert span.key == "a"

    # Position 0 should not be in any span (static text)
    span = rendered.get_span_at(0)
    assert span is None


def test_get_span_for_key():
    """Test get_span_for_key to find span by key."""
    name = "Alice"
    age = "30"
    p = t_prompts.prompt(t"Name: {name:n}, Age: {age:a}")

    rendered = p.render()

    # Find span for key "n"
    span = rendered.get_span_for_key("n")
    assert span is not None
    assert span.start == 6
    assert span.end == 11
    assert rendered.text[span.start:span.end] == "Alice"

    # Find span for key "a"
    span = rendered.get_span_for_key("a")
    assert span is not None
    assert span.start == 18
    assert span.end == 20
    assert rendered.text[span.start:span.end] == "30"

    # Non-existent key
    span = rendered.get_span_for_key("nonexistent")
    assert span is None


def test_source_map_with_nested_prompts():
    """Test source mapping with nested prompts."""
    inner = "world"
    p_inner = t_prompts.prompt(t"{inner:i}")
    p_outer = t_prompts.prompt(t"Hello {p_inner:p}!")

    rendered = p_outer.render()

    # Should have one span for the inner interpolation
    assert len(rendered.source_map) == 1

    span = rendered.source_map[0]
    assert span.start == 6  # After "Hello "
    assert span.end == 11  # After "world"
    assert span.key == "i"
    assert span.path == ("p",)  # Path through outer key


def test_source_map_deeply_nested():
    """Test source mapping with deeply nested prompts."""
    a = "A"
    p1 = t_prompts.prompt(t"{a:a}")
    p2 = t_prompts.prompt(t"[{p1:p1}]")
    p3 = t_prompts.prompt(t"<{p2:p2}>")

    rendered = p3.render()

    # Should have one span for the innermost value
    assert len(rendered.source_map) == 1

    span = rendered.source_map[0]
    assert span.start == 2  # After "<["
    assert span.end == 3  # After "A"
    assert span.key == "a"
    assert span.path == ("p2", "p1")  # Path through nested keys


def test_source_map_with_conversions():
    """Test that source map accounts for conversion changes."""
    text = "hello"
    p = t_prompts.prompt(t"{text!r:t}")

    rendered = p.render()

    # !r adds quotes, so length changes
    assert rendered.text == "'hello'"

    span = rendered.source_map[0]
    assert span.start == 0
    assert span.end == 7  # Length of "'hello'"
    assert rendered.text[span.start:span.end] == "'hello'"


def test_rendered_prompt_str():
    """Test that str(RenderedPrompt) returns text."""
    value = "test"
    p = t_prompts.prompt(t"{value:v}")

    rendered = p.render()

    assert str(rendered) == "test"


def test_rendered_prompt_repr():
    """Test RenderedPrompt repr."""
    value = "test"
    p = t_prompts.prompt(t"{value:v}")

    rendered = p.render()
    repr_str = repr(rendered)

    assert "RenderedPrompt" in repr_str
    assert "spans=1" in repr_str


def test_source_map_with_multiple_nested_interpolations():
    """Test source mapping with multiple interpolations in nested prompts."""
    a = "A"
    b = "B"
    p_inner = t_prompts.prompt(t"{a:a}-{b:b}")
    p_outer = t_prompts.prompt(t"[{p_inner:p}]")

    rendered = p_outer.render()

    # Should have two spans, one for each inner interpolation
    assert len(rendered.source_map) == 2

    # First span for "a"
    span1 = rendered.source_map[0]
    assert span1.key == "a"
    assert span1.path == ("p",)
    assert rendered.text[span1.start:span1.end] == "A"

    # Second span for "b"
    span2 = rendered.source_map[1]
    assert span2.key == "b"
    assert span2.path == ("p",)
    assert rendered.text[span2.start:span2.end] == "B"


def test_get_span_for_key_with_path():
    """Test get_span_for_key with path parameter."""
    inner = "inner"
    p_inner = t_prompts.prompt(t"{inner:i}")
    p_outer = t_prompts.prompt(t"{p_inner:p}")

    rendered = p_outer.render()

    # Find span with correct path
    span = rendered.get_span_for_key("i", path=("p",))
    assert span is not None
    assert span.key == "i"

    # Wrong path should return None
    span = rendered.get_span_for_key("i", path=())
    assert span is None

    # Wrong path should return None
    span = rendered.get_span_for_key("i", path=("wrong",))
    assert span is None


def test_source_span_dataclass():
    """Test SourceSpan dataclass properties."""
    span = t_prompts.SourceSpan(start=0, end=5, key="test", path=("a", "b"))

    assert span.start == 0
    assert span.end == 5
    assert span.key == "test"
    assert span.path == ("a", "b")
