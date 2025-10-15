"""Tests for render hints (xml= and header=)."""

import pytest

import t_prompts

# XML hint tests


def test_xml_hint_basic():
    """Test basic XML hint wraps content in tags."""
    content = "This is some content"
    p = t_prompts.prompt(t"{content:c:xml=tag}")

    expected = "<tag>\nThis is some content\n</tag>"
    assert str(p) == expected


def test_xml_hint_nested_prompt():
    """Test XML hint with nested prompt."""
    inner_text = "inner content"
    inner = t_prompts.prompt(t"{inner_text:inner}")

    outer = t_prompts.prompt(t"{inner:i:xml=section}")

    expected = "<section>\ninner content\n</section>"
    assert str(outer) == expected


def test_xml_hint_multiline_content():
    """Test XML hint with multiline content."""
    content = "Line 1\nLine 2\nLine 3"
    p = t_prompts.prompt(t"{content:c:xml=data}")

    expected = "<data>\nLine 1\nLine 2\nLine 3\n</data>"
    assert str(p) == expected


def test_xml_hint_empty_content():
    """Test XML hint with empty content."""
    content = ""
    p = t_prompts.prompt(t"{content:c:xml=empty}")

    expected = "<empty>\n\n</empty>"
    assert str(p) == expected


def test_xml_hint_with_whitespace_trimming():
    """Test that XML tag name is trimmed of surrounding whitespace."""
    content = "content"
    # Leading/trailing spaces in hint specification should be trimmed
    p = t_prompts.prompt(t"{content:c:xml= tag }")

    expected = "<tag>\ncontent\n</tag>"
    assert str(p) == expected


def test_xml_hint_rejects_tag_with_whitespace():
    """Test that XML tag name cannot contain whitespace."""
    content = "content"

    with pytest.raises(ValueError, match="XML tag name cannot contain whitespace"):
        p = t_prompts.prompt(t"{content:c:xml=bad tag}")
        str(p)  # Trigger rendering


def test_xml_hint_rejects_tag_with_tab():
    """Test that XML tag name cannot contain tabs."""
    content = "content"

    with pytest.raises(ValueError, match="XML tag name cannot contain whitespace"):
        p = t_prompts.prompt(t"{content:c:xml=bad\ttag}")
        str(p)


def test_xml_hint_rejects_tag_with_newline():
    """Test that XML tag name cannot contain newlines."""
    content = "content"

    with pytest.raises(ValueError, match="XML tag name cannot contain whitespace"):
        p = t_prompts.prompt(t"{content:c:xml=bad\ntag}")
        str(p)


def test_xml_hint_with_list():
    """Test XML hint wrapping entire list interpolation."""
    items = [
        t_prompts.prompt(t"{item:item}")
        for item in ["apple", "banana", "cherry"]
    ]

    p = t_prompts.prompt(t"{items:list:xml=fruits}")

    expected = "<fruits>\napple\nbanana\ncherry\n</fruits>"
    assert str(p) == expected


# Header hint tests


def test_header_hint_with_value():
    """Test header hint with explicit heading text."""
    task = "Analyze this"
    p = t_prompts.prompt(t"{task:t:header=Task Description}")

    expected = "# Task Description\nAnalyze this"
    assert str(p) == expected


def test_header_hint_without_value():
    """Test header hint without value uses key as heading."""
    task = "Analyze this"
    p = t_prompts.prompt(t"{task:my_task:header}")

    expected = "# my_task\nAnalyze this"
    assert str(p) == expected


def test_header_hint_with_multiline_content():
    """Test header hint with multiline content."""
    content = "Line 1\nLine 2\nLine 3"
    p = t_prompts.prompt(t"{content:c:header=Section}")

    expected = "# Section\nLine 1\nLine 2\nLine 3"
    assert str(p) == expected


def test_header_hint_with_whitespace_in_heading():
    """Test that header heading text can contain whitespace."""
    content = "Content"
    p = t_prompts.prompt(t"{content:c:header=My Long Heading Text}")

    expected = "# My Long Heading Text\nContent"
    assert str(p) == expected


def test_header_hint_nested_level_2():
    """Test header hint increments level in nested prompts."""
    inner_content = "Inner text"
    inner = t_prompts.prompt(t"{inner_content:ic:header=Subsection}")

    outer_content = "Outer text"
    outer = t_prompts.prompt(t"{outer_content:oc:header=Main Section}\n{inner:inner:header}")

    # Main Section is level 1 (#)
    # inner key gets header at level 1 (#)
    # Subsection inside inner gets level 2 (##) because inner has header hint
    expected = "# Main Section\nOuter text\n# inner\n## Subsection\nInner text"
    assert str(outer) == expected


def test_header_hint_nested_multiple_levels():
    """Test header hint with multiple nesting levels."""
    level3_content = "Level 3 content"
    level3 = t_prompts.prompt(t"{level3_content:c3:header=Level 3}")

    level2 = t_prompts.prompt(t"{level3:l3:header=Level 2}")

    level1 = t_prompts.prompt(t"{level2:l2:header=Level 1}")

    expected = "# Level 1\n## Level 2\n### Level 3\nLevel 3 content"
    assert str(level1) == expected


def test_header_hint_max_level_capping():
    """Test that header level is capped at max_header_level (default 4)."""
    # Create 5 levels of nesting
    content = "Deep content"
    p1 = t_prompts.prompt(t"{content:c:header=Level 5}")
    p2 = t_prompts.prompt(t"{p1:p1:header=Level 4}")
    p3 = t_prompts.prompt(t"{p2:p2:header=Level 3}")
    p4 = t_prompts.prompt(t"{p3:p3:header=Level 2}")
    p5 = t_prompts.prompt(t"{p4:p4:header=Level 1}")

    result = str(p5)

    # Level 5 should be capped at 4 (####)
    assert "# Level 1\n" in result
    assert "## Level 2\n" in result
    assert "### Level 3\n" in result
    assert "#### Level 4\n" in result
    assert "#### Level 5\n" in result  # Capped at 4
    assert "#####" not in result  # Should not have 5 hashes


def test_header_hint_only_increments_for_header_nodes():
    """Test that header level only increments when passing through nodes with header hint."""
    inner_content = "Inner"
    inner = t_prompts.prompt(t"{inner_content:ic:header=Inner Header}")

    # Middle has no header hint on itself, but inner interpolation has header hint
    middle = t_prompts.prompt(t"Prefix {inner:inner:header} Suffix")

    # Outer has header hint
    outer = t_prompts.prompt(t"{middle:middle:header=Outer Header}")

    # Outer Header at level 1 (#)
    # inner key at level 2 (##) because outer has header hint
    # Inner Header at level 3 (###) because both outer and inner interpolation have header hints
    expected = "# Outer Header\nPrefix ## inner\n### Inner Header\nInner Suffix"
    assert str(outer) == expected


def test_header_hint_with_empty_content():
    """Test header hint with empty content."""
    content = ""
    p = t_prompts.prompt(t"{content:c:header=Empty Section}")

    expected = "# Empty Section\n"
    assert str(p) == expected


def test_header_hint_with_list():
    """Test header hint wrapping entire list interpolation."""
    items = [
        t_prompts.prompt(t"{item:item}")
        for item in ["First", "Second", "Third"]
    ]

    p = t_prompts.prompt(t"{items:list:header=Items}")

    expected = "# Items\nFirst\nSecond\nThird"
    assert str(p) == expected


# Combined hints tests


def test_combined_xml_and_header():
    """Test combining XML and header hints."""
    content = "Some content"
    p = t_prompts.prompt(t"{content:c:header=Section:xml=content}")

    # Header should be outer, XML should be inner
    expected = "# Section\n<content>\nSome content\n</content>"
    assert str(p) == expected


def test_combined_header_and_xml():
    """Test combining header and XML hints (different order)."""
    content = "Some content"
    p = t_prompts.prompt(t"{content:c:xml=data:header=Section}")

    # Order in format spec shouldn't matter - header is always outer
    expected = "# Section\n<data>\nSome content\n</data>"
    assert str(p) == expected


def test_combined_hints_nested():
    """Test combined hints with nested prompts."""
    inner = "Inner text"
    inner_p = t_prompts.prompt(t"{inner:i:header=Inner:xml=inner_tag}")

    outer = "Outer text"
    outer_p = t_prompts.prompt(t"{outer:o:header=Outer}\n{inner_p:inner:header:xml=outer_tag}")

    result = str(outer_p)

    # Check structure
    assert "# Outer\nOuter text\n" in result
    # inner interpolation has header hint, so gets # at level 1, wrapped in XML
    assert "# inner\n<outer_tag>" in result
    # Inner content has header at level 2 (because inner interpolation has header hint)
    assert "## Inner\n<inner_tag>\nInner text\n</inner_tag>" in result


def test_combined_hints_with_list():
    """Test combined hints wrapping a list."""
    items = [
        t_prompts.prompt(t"{item:item}")
        for item in ["A", "B", "C"]
    ]

    p = t_prompts.prompt(t"{items:list:header=Items:xml=list}")

    expected = "# Items\n<list>\nA\nB\nC\n</list>"
    assert str(p) == expected


def test_combined_hints_multiline():
    """Test combined hints with multiline content."""
    content = "Line 1\nLine 2\nLine 3"
    p = t_prompts.prompt(t"{content:c:header=Multi:xml=lines}")

    expected = "# Multi\n<lines>\nLine 1\nLine 2\nLine 3\n</lines>"
    assert str(p) == expected


# Separator hint with other hints


def test_xml_hint_with_custom_separator():
    """Test XML hint with custom list separator."""
    items = [
        t_prompts.prompt(t"{item:item}")
        for item in ["apple", "banana", "cherry"]
    ]

    p = t_prompts.prompt(t"{items:list:xml=fruits:sep=, }")

    expected = "<fruits>\napple, banana, cherry\n</fruits>"
    assert str(p) == expected


def test_header_hint_with_custom_separator():
    """Test header hint with custom list separator."""
    items = [
        t_prompts.prompt(t"{item:item}")
        for item in ["First", "Second", "Third"]
    ]

    p = t_prompts.prompt(t"{items:list:header=Items:sep= | }")

    expected = "# Items\nFirst | Second | Third"
    assert str(p) == expected


def test_all_hints_combined():
    """Test XML, header, and sep hints all together."""
    items = [
        t_prompts.prompt(t"{item:item}")
        for item in ["X", "Y", "Z"]
    ]

    p = t_prompts.prompt(t"{items:list:header=Letters:xml=letters:sep=,}")

    expected = "# Letters\n<letters>\nX,Y,Z\n</letters>"
    assert str(p) == expected


# Integration with other features


def test_header_hint_with_dedent():
    """Test that header hints work with dedenting."""
    content = "Content"
    p = t_prompts.dedent(t"""
        {content:c:header=Section}
        """)

    expected = "# Section\nContent"
    assert str(p) == expected


def test_xml_hint_with_dedent():
    """Test that XML hints work with dedenting."""
    content = "Content"
    p = t_prompts.dedent(t"""
        {content:c:xml=section}
        """)

    expected = "<section>\nContent\n</section>"
    assert str(p) == expected


def test_combined_hints_with_dedent():
    """Test combined hints with dedenting."""
    content = "Content"
    p = t_prompts.dedent(t"""
        {content:c:header=Section:xml=data}
        """)

    expected = "# Section\n<data>\nContent\n</data>"
    assert str(p) == expected


def test_hints_with_conversions():
    """Test that hints work with conversions."""
    content = "test"
    p = t_prompts.prompt(t"{content!r:c:header=Section:xml=data}")

    # Conversion should be applied to content
    expected = "# Section\n<data>\n'test'\n</data>"
    assert str(p) == expected
