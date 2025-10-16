"""Edge case tests for structured prompts."""

import pytest

import t_prompts
from t_prompts.exceptions import DuplicateKeyError


def test_duplicate_keys_raise_error():
    """Test that duplicate keys raise DuplicateKeyError by default."""
    a = "A"
    b = "B"

    with pytest.raises(DuplicateKeyError) as exc_info:
        t_prompts.prompt(t"{a:x} {b:x}")

    assert "Duplicate key 'x'" in str(exc_info.value)
    assert "allow_duplicate_keys=True" in str(exc_info.value)


def test_duplicate_keys_allowed():
    """Test that duplicate keys work with allow_duplicate_keys=True."""
    a = "A"
    b = "B"

    p = t_prompts.prompt(t"{a:x} {b:x}", allow_duplicate_keys=True)

    # Rendering still works
    assert str(p) == "A B"

    # __getitem__ with single key raises due to ambiguity
    with pytest.raises(ValueError) as exc_info:
        _ = p["x"]
    assert "Ambiguous key 'x'" in str(exc_info.value)
    assert "get_all" in str(exc_info.value)

    # get_all returns all occurrences
    nodes = p.get_all("x")
    assert len(nodes) == 2
    assert nodes[0].value == "A"
    assert nodes[1].value == "B"


def test_expression_with_whitespace():
    """Test that expressions with whitespace in keys via format spec."""
    value = "test"
    # Note: Python t-strings normalize expression whitespace
    # To preserve internal whitespace in keys, use format spec
    p = t_prompts.prompt(t"{value: value }")

    # Key comes from format spec - leading/trailing trimmed, internal preserved
    assert "value" in p
    node = p["value"]
    assert node.value == "test"
    assert node.format_spec == " value "


def test_empty_string_segments():
    """Test handling of empty string segments."""
    a = "A"
    b = "B"

    # First and last can be empty
    p = t_prompts.prompt(t"{a:a} {b:b}")

    assert str(p) == "A B"
    # First string segment is empty, second is " ", third is empty
    assert p.strings[0] == ""
    assert p.strings[1] == " "
    assert p.strings[2] == ""


def test_adjacent_interpolations():
    """Test that adjacent interpolations work correctly."""
    a = "A"
    b = "B"

    p = t_prompts.prompt(t"{a:a}{b:b}")

    assert str(p) == "AB"
    # Strings should be: ["", "", ""]
    assert len(p.strings) == 3
    assert all(s == "" for s in p.strings)


def test_format_spec_as_key_not_used_for_formatting():
    """Test that format spec used as key is NOT applied as formatting by default."""
    # Use string value (library only accepts str or StructuredPrompt)
    num = "42"

    # Even though "05d" looks like a format spec, it's used as a key label
    p = t_prompts.prompt(t"{num:05d}")

    # Should render as "42", NOT "00042"
    assert str(p) == "42"

    node = p["05d"]
    assert node.key == "05d"
    assert node.format_spec == "05d"


def test_multiple_whitespace_variations():
    """Test different whitespace patterns in format specs."""
    a = "A"

    # Python t-strings normalize expression whitespace, so use format specs
    p1 = t_prompts.prompt(t"{a:a}")
    p2 = t_prompts.prompt(t"{a: a }")
    p3 = t_prompts.prompt(t"{a:  a  }")

    # All render the same
    assert str(p1) == "A"
    assert str(p2) == "A"
    assert str(p3) == "A"

    # Keys from format specs are trimmed (leading/trailing removed)
    assert "a" in p1
    assert "a" in p2
    assert "a" in p3


def test_single_interpolation_only():
    """Test prompt that is only an interpolation (no surrounding text)."""
    x = "X"

    p = t_prompts.prompt(t"{x:x}")

    assert str(p) == "X"
    assert p.strings == ("", "")


def test_very_long_prompt():
    """Test handling of prompts with many interpolations."""
    # Create a template with multiple interpolations
    # For testing purposes, just do a reasonable number manually
    v0, v1, v2, v3, v4 = "A", "B", "C", "D", "E"

    p = t_prompts.prompt(t"{v0:v0} {v1:v1} {v2:v2} {v3:v3} {v4:v4}")

    assert str(p) == "A B C D E"
    assert len(p) == 5
    assert len(p.interpolations) == 5


def test_complex_nested_structure():
    """Test complex nested structure with mixed formats."""
    inst1 = "Be polite"
    inst2 = "Be concise"
    user = "Alice"

    p_inst = t_prompts.prompt(t"Instructions: {inst1:i1}, {inst2:i2}")
    p_user = t_prompts.prompt(t"User: {user}")
    p_full = t_prompts.prompt(t"{p_inst:instructions} {p_user:user_info}")

    expected = "Instructions: Be polite, Be concise User: Alice"
    assert str(p_full) == expected

    # Navigate deeply
    assert p_full["instructions"]["i1"].value == "Be polite"
    assert p_full["instructions"]["i2"].value == "Be concise"
    assert p_full["user_info"]["user"].value == "Alice"


def test_conversion_with_format_spec_key():
    """Test that conversion works correctly when format spec is used as key."""
    text = "hello"

    p = t_prompts.prompt(t"{text!r:greeting}")

    # Should apply conversion but not format spec
    assert str(p) == "'hello'"

    node = p["greeting"]
    assert node.conversion == "r"
    assert node.format_spec == "greeting"


def test_empty_nested_prompt():
    """Test nesting a prompt that has no interpolations."""
    p_empty = t_prompts.prompt(t"just text")
    x = "X"
    p_outer = t_prompts.prompt(t"{x:x} and {p_empty:empty}")

    assert str(p_outer) == "X and just text"

    # StructuredPrompt is now stored directly as a child element
    empty_node = p_outer["empty"]
    assert isinstance(empty_node, t_prompts.StructuredPrompt)
    assert len(empty_node) == 0
