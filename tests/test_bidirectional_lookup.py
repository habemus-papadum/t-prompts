"""Tests for bidirectional source mapping lookups."""

import t_prompts


def test_get_spans_for_element():
    """Test getting all spans for a specific element by ID."""
    value = "test"
    p = t_prompts.prompt(t"Value: {value:v}")

    rendered = p.render()

    # Get the element
    element = p["v"]

    # Use the new bidirectional lookup
    spans = rendered.get_spans_for_element(element.id)

    # Should have exactly one span for this element
    assert len(spans) == 1
    assert spans[0].key == "v"
    assert spans[0].element_id == element.id
    assert rendered.text[spans[0].start:spans[0].end] == "test"


def test_get_spans_for_prompt_simple():
    """Test getting all spans for a StructuredPrompt."""
    value = "test"
    p = t_prompts.prompt(t"Value: {value:v}")

    rendered = p.render()

    # Get all spans for the entire prompt
    spans = rendered.get_spans_for_prompt(p)

    # Should have spans for both static and interpolation
    assert len(spans) == 2

    # Check we have a static span
    static_spans = [s for s in spans if s.element_type == "static"]
    assert len(static_spans) == 1

    # Check we have an interpolation span
    interp_spans = [s for s in spans if s.element_type == "interpolation"]
    assert len(interp_spans) == 1


def test_get_spans_for_prompt_nested():
    """Test getting all spans for a nested prompt."""
    inner = "world"
    p_inner = t_prompts.prompt(t"{inner:i}")
    p_outer = t_prompts.prompt(t"Hello {p_inner:p}!")

    rendered = p_outer.render()

    # Get spans for the inner prompt
    inner_spans = rendered.get_spans_for_prompt(p_inner)

    # Should have spans from the inner prompt
    assert len(inner_spans) > 0

    # Check that spans have correct path
    interp_spans = [s for s in inner_spans if s.element_type == "interpolation"]
    assert len(interp_spans) == 1
    assert interp_spans[0].path == ("p",)
    assert interp_spans[0].key == "i"


def test_element_spans_property():
    """Test the element_spans reverse index property."""
    name = "Alice"
    age = "30"
    p = t_prompts.prompt(t"Name: {name:n}, Age: {age:a}")

    rendered = p.render()

    # The element_spans property should have entries for all elements
    assert len(rendered.element_spans) >= 2

    # Get element IDs
    name_elem = p["n"]
    age_elem = p["a"]

    # Check that both elements are in the reverse index
    assert name_elem.id in rendered.element_spans
    assert age_elem.id in rendered.element_spans

    # Check the spans are correct
    name_spans = rendered.element_spans[name_elem.id]
    assert len(name_spans) == 1
    assert rendered.text[name_spans[0].start:name_spans[0].end] == "Alice"

    age_spans = rendered.element_spans[age_elem.id]
    assert len(age_spans) == 1
    assert rendered.text[age_spans[0].start:age_spans[0].end] == "30"


def test_chunks_property():
    """Test that rendered output has chunks."""
    value = "test"
    p = t_prompts.prompt(t"Value: {value:v}")

    rendered = p.render()

    # Should have exactly one chunk (text-only rendering)
    assert len(rendered.chunks) == 1

    # Check it's a TextChunk
    chunk = rendered.chunks[0]
    assert isinstance(chunk, t_prompts.TextChunk)
    assert chunk.text == "Value: test"
    assert chunk.chunk_index == 0


def test_source_span_has_chunk_index():
    """Test that source spans include chunk_index."""
    value = "test"
    p = t_prompts.prompt(t"Value: {value:v}")

    rendered = p.render()

    # All spans should have chunk_index = 0 (text-only rendering)
    for span in rendered.source_map:
        assert span.chunk_index == 0


def test_source_span_has_element_id():
    """Test that source spans include element_id."""
    value = "test"
    p = t_prompts.prompt(t"Value: {value:v}")

    rendered = p.render()

    # All spans should have a valid element_id
    for span in rendered.source_map:
        assert span.element_id is not None
        assert len(span.element_id) > 0
