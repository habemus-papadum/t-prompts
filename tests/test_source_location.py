"""Test source location tracking in structured prompts.

This module tests the basic functionality of source location capture.
"""


from t_prompts import SourceLocation, Static, StructuredPrompt, prompt


def test_source_location_dataclass_defaults():
    """Test that SourceLocation can be created with all None values."""
    loc = SourceLocation()
    assert loc.filename is None
    assert loc.filepath is None
    assert loc.line is None
    assert not loc.is_available


def test_source_location_is_available():
    """Test the is_available property."""
    # No filename -> not available
    loc1 = SourceLocation()
    assert not loc1.is_available

    # Has filename -> available
    loc2 = SourceLocation(filename="test.py", line=42)
    assert loc2.is_available


def test_source_location_format_location():
    """Test the format_location() method."""
    # Not available
    loc1 = SourceLocation()
    assert loc1.format_location() == "<unavailable>"

    # Just filename
    loc2 = SourceLocation(filename="test.py")
    assert loc2.format_location() == "test.py"

    # Filename and line
    loc3 = SourceLocation(filename="test.py", line=42)
    assert loc3.format_location() == "test.py:42"


def test_source_location_captured_by_default():
    """Test that source location is captured by default."""
    task = "translate"
    p = prompt(t"Task: {task}")

    # Check that source location was captured
    assert p['task'].source_location is not None
    assert p['task'].source_location.is_available
    assert p['task'].source_location.filename == "test_source_location.py"
    assert p['task'].source_location.line is not None
    assert p['task'].source_location.line > 0


def test_source_location_disabled():
    """Test that source location capture can be disabled."""
    task = "translate"
    p = prompt(t"Task: {task}", capture_source_location=False)

    # Check that source location was NOT captured
    assert p['task'].source_location is None


def test_source_location_on_static_elements():
    """Test that static elements also have source location."""
    task = "translate"
    p = prompt(t"Task: {task}")

    # Check static elements
    for element in p.children:
        if isinstance(element, Static):
            # Static elements should also have source location
            assert element.source_location is not None
            assert element.source_location.is_available


def test_source_location_on_nested_prompts():
    """Test that nested prompts have both creation_location and source_location."""
    x = "value"
    inner = prompt(t"Inner: {x}")  # Line 83: inner created here
    outer = prompt(t"Outer: {inner:i}")  # Line 84: inner interpolated here

    # The nested prompt (now stored directly) should have both locations
    inner_prompt = outer['i']  # StructuredPrompt is now stored directly
    assert isinstance(inner_prompt, StructuredPrompt)

    # source_location = where it was interpolated (line 84)
    assert inner_prompt.source_location is not None
    assert inner_prompt.source_location.is_available
    assert inner_prompt.source_location.line == 84

    # creation_location = where it was created (line 83)
    assert inner_prompt.creation_location is not None
    assert inner_prompt.creation_location.is_available
    assert inner_prompt.creation_location.line == 83

    # Its children should have source_location = inner's creation_location
    assert inner_prompt['x'].source_location is not None
    assert inner_prompt['x'].source_location.is_available
    assert inner_prompt['x'].source_location.line == 83

    # With the new architecture, outer['i'] IS the inner prompt object
    assert outer['i'] is inner
    # Children's source_location matches the prompt's creation_location
    assert outer['i'].creation_location.line == inner_prompt['x'].source_location.line


def test_source_location_with_multiple_interpolations():
    """Test source location with multiple interpolations on same line."""
    x = "a"
    y = "b"
    p = prompt(t"{x} and {y}")

    # Both should have source locations
    assert p['x'].source_location is not None
    assert p['y'].source_location is not None

    # Should be on the same line
    # Note: Currently source location captures the prompt() call line, not individual interpolations
    assert p['x'].source_location.line == p['y'].source_location.line


def test_source_location_with_list_interpolation():
    """Test that list interpolations have source location."""
    item0 = "first"
    item1 = "second"
    items = [prompt(t"Item: {item0}"), prompt(t"Item: {item1}")]
    p = prompt(t"Items: {items:list}")

    # List interpolation should have source location
    assert p['list'].source_location is not None
    assert p['list'].source_location.is_available
