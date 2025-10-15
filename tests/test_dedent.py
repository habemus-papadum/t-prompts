"""Tests for dedenting and trimming functionality."""

import pytest

import t_prompts

# =============================================================================
# Basic Dedenting Tests
# =============================================================================


def test_dedent_basic():
    """Test basic dedenting with uniform indentation."""
    text = "world"
    p = t_prompts.prompt(t"""
    Hello {text:t}
    How are you?
    """, dedent=True)

    assert str(p) == "Hello world\nHow are you?"


def test_dedent_with_interpolation_mid_text():
    """Test dedenting with interpolation in the middle."""
    name = "Alice"
    age = "30"
    p = t_prompts.prompt(t"""
    Name: {name:n}
    Age: {age:a}
    Status: Active
    """, dedent=True)

    assert str(p) == "Name: Alice\nAge: 30\nStatus: Active"


def test_dedent_multiple_statics():
    """Test dedenting across multiple static segments."""
    x = "X"
    y = "Y"
    p = t_prompts.prompt(t"""
    First: {x:x}
    Second: {y:y}
    Done
    """, dedent=True)

    assert str(p) == "First: X\nSecond: Y\nDone"


def test_dedent_nested_prompts():
    """Test that nested prompts are dedented independently."""
    inner = t_prompts.prompt(t"""
    Inner content
    More inner
    """, dedent=True)

    outer = t_prompts.prompt(t"""
    Outer start
    {inner:inner}
    Outer end
    """, dedent=True)

    # Note: The inner prompt retains the indentation from the outer prompt's static text
    # because the static "\n    " before {inner:inner} is dedented to "\n    "
    # This is expected behavior - dedenting happens at construction time
    result = str(outer)
    assert "Outer start" in result
    assert "Inner content" in result
    assert "More inner" in result
    assert "Outer end" in result


# =============================================================================
# Trim Leading Tests
# =============================================================================


def test_trim_leading_basic():
    """Test removing leading whitespace line."""
    p = t_prompts.prompt(t"""
    Hello
    World
    """, dedent=False, trim_leading=True, trim_trailing=False)

    # First line removed, but no dedenting, trailing preserved
    assert str(p) == "    Hello\n    World\n    "


def test_trim_leading_with_dedent():
    """Test trim leading combined with dedent."""
    p = t_prompts.prompt(t"""
    Hello
    World
    """, dedent=True, trim_leading=True)

    assert str(p) == "Hello\nWorld"


def test_trim_leading_only_newline():
    """Test trim leading when first line is just newline."""
    p = t_prompts.prompt(t"""
Hello
World
""", dedent=False, trim_leading=True, trim_trailing=False)

    assert str(p) == "Hello\nWorld\n"


def test_no_trim_leading():
    """Test that trim_leading=False preserves first line."""
    p = t_prompts.prompt(t"""
    Hello
    """, dedent=True, trim_leading=False, trim_trailing=False, trim_empty_leading=False)

    # First line not removed, trim_empty_leading also OFF
    # With all trims off, dedenting still happens based on "Hello" line
    result = str(p)
    # The "\n" at start is preserved, and dedenting happens based on "    Hello"
    # The trailing "    " is also dedented to "" (whitespace-only lines are dedented too)
    assert result == "\nHello\n"


# =============================================================================
# Trim Empty Leading Tests
# =============================================================================


def test_trim_empty_leading_basic():
    """Test removing empty lines after first line."""
    p = t_prompts.prompt(t"""

    Hello
    """, dedent=True, trim_empty_leading=True)

    assert str(p) == "Hello"


def test_trim_empty_leading_multiple():
    """Test removing multiple empty lines."""
    p = t_prompts.prompt(t"""


    Hello
    """, dedent=True, trim_empty_leading=True)

    assert str(p) == "Hello"


def test_no_trim_empty_leading():
    """Test that trim_empty_leading=False preserves empty lines."""
    p = t_prompts.prompt(t"""

    Hello
    """, dedent=True, trim_empty_leading=False)

    # Empty line preserved
    assert str(p).startswith("\n")


# =============================================================================
# Trim Trailing Tests
# =============================================================================


def test_trim_trailing_basic():
    """Test removing trailing newlines."""
    p = t_prompts.prompt(t"""
    Hello
    """, dedent=True, trim_trailing=True)

    assert str(p) == "Hello"
    assert not str(p).endswith("\n")


def test_trim_trailing_multiple():
    """Test removing multiple trailing newlines."""
    p = t_prompts.prompt(t"""
    Hello


    """, dedent=True, trim_trailing=True)

    assert str(p) == "Hello"


def test_no_trim_trailing():
    """Test that trim_trailing=False preserves trailing newlines."""
    p = t_prompts.prompt(t"""
    Hello
    """, dedent=True, trim_trailing=False)

    # Trailing whitespace is preserved when trim_trailing=False
    # Note: whitespace-only lines are also dedented, so "    " becomes ""
    result = str(p)
    assert result == "Hello\n"  # Dedented, trailing whitespace also dedented


# =============================================================================
# Combined Features Tests
# =============================================================================


def test_all_features_enabled():
    """Test with all dedent features enabled."""
    task = "translate"
    p = t_prompts.prompt(t"""
    You are a helpful assistant.

    Task: {task:t}

    Please respond.
    """, dedent=True, trim_leading=True, trim_empty_leading=True, trim_trailing=True)

    expected = "You are a helpful assistant.\n\nTask: translate\n\nPlease respond."
    assert str(p) == expected


def test_only_trims_no_dedent():
    """Test with trims enabled but dedent disabled."""
    p = t_prompts.prompt(t"""
    Hello
    """, dedent=False, trim_leading=True, trim_trailing=True)

    # Trims applied but indentation preserved
    assert str(p) == "    Hello"


def test_no_features_enabled():
    """Test with all features disabled."""
    p = t_prompts.prompt(t"""
    Hello
    """, dedent=False, trim_leading=False, trim_trailing=False, trim_empty_leading=False)

    # Everything preserved including leading newline
    result = str(p)
    # Template strings are ("\n    Hello\n    ", )
    # With no processing, we still get trims by default, so disable all
    assert result == "\n    Hello\n    "


# =============================================================================
# Edge Cases
# =============================================================================


def test_empty_first_static():
    """Test dedenting when first static is empty."""
    x = "X"
    p = t_prompts.prompt(t"{x:x} indented", dedent=True)

    # First static is empty, second static " indented" is dedented
    # The space at the start is treated as the indent and removed
    assert str(p) == "Xindented"


def test_only_interpolations():
    """Test dedenting with no static content."""
    a = "A"
    b = "B"
    p = t_prompts.prompt(t"{a:a}{b:b}", dedent=True)

    # No effect, just concatenates values
    assert str(p) == "AB"


def test_no_non_empty_lines():
    """Test dedenting with only whitespace."""
    p = t_prompts.prompt(t"""

    """, dedent=True)

    # All whitespace removed
    assert str(p) == ""


def test_mixed_indentation_levels():
    """Test dedenting with varying indentation levels."""
    p = t_prompts.prompt(t"""
    First line (4 spaces)
      Second line (6 spaces)
    Third line (4 spaces)
    """, dedent=True)

    # Dedented by 4 spaces (the first non-empty line)
    expected = "First line (4 spaces)\n  Second line (6 spaces)\nThird line (4 spaces)"
    assert str(p) == expected


def test_less_indented_line():
    """Test dedenting when a later line has less indentation."""
    p = t_prompts.prompt(t"""
        Indented by 8
      Indented by 6
    """, dedent=True)

    # Dedented by 8 spaces (first non-empty line)
    # Second line only has 6, so it dedents as much as possible
    expected = "Indented by 8\nIndented by 6"
    assert str(p) == expected


def test_single_line_no_newlines():
    """Test dedenting with single line content."""
    p = t_prompts.prompt(t"    Hello", dedent=True, trim_leading=False)

    # Single line, dedented
    assert str(p) == "Hello"


def test_interpolation_in_first_line():
    """Test with interpolation right after removed first line."""
    name = "Alice"
    p = t_prompts.prompt(t"""
    Hello {name:n}
    How are you?
    """, dedent=True)

    assert str(p) == "Hello Alice\nHow are you?"


def test_empty_lines_preserved_in_middle():
    """Test that empty lines in the middle are preserved."""
    p = t_prompts.prompt(t"""
    First

    Third
    """, dedent=True)

    expected = "First\n\nThird"
    assert str(p) == expected


# =============================================================================
# Error Cases
# =============================================================================


def test_mixed_tabs_and_spaces_error():
    """Test that mixed tabs and spaces raise an error."""
    with pytest.raises(t_prompts.DedentError, match="Mixed tabs and spaces"):
        # Mix tabs and spaces in indentation
        t_prompts.prompt(t"""
\t    Hello
        """, dedent=True)


# =============================================================================
# Source Mapping Tests
# =============================================================================


def test_provenance_preserves_original_strings():
    """Test that original strings are preserved in template."""
    text = "world"
    p = t_prompts.prompt(t"""
    Hello {text:t}
    """, dedent=True)

    # Original strings should still be in template
    assert p.template.strings == ("\n    Hello ", "\n    ")

    # But rendered text uses dedented versions
    assert str(p) == "Hello world"


# =============================================================================
# List Interpolation Tests with Dedenting
# =============================================================================


def test_list_with_dedent():
    """Test that list interpolations work with dedenting."""
    items = [
        t_prompts.prompt(t"Item {i:i}") for i in ["1", "2", "3"]
    ]

    p = t_prompts.prompt(t"""
    Items:
    {items:items}
    Done
    """, dedent=True)

    # The list items are rendered as-is, but the static text around them is dedented
    # The newline + spaces before {items:items} becomes just "\n    " after dedenting
    result = str(p)
    assert "Items:" in result
    assert "Item 1" in result
    assert "Item 2" in result
    assert "Item 3" in result
    assert "Done" in result


def test_list_with_custom_separator_and_dedent():
    """Test list with custom separator and dedenting."""
    items = [
        t_prompts.prompt(t"{i:i}") for i in ["A", "B", "C"]
    ]

    p = t_prompts.prompt(t"""
    List: {items:items:sep=, }
    """, dedent=True)

    expected = "List: A, B, C"
    assert str(p) == expected


# =============================================================================
# Realistic Use Cases
# =============================================================================


def test_realistic_llm_prompt():
    """Test a realistic LLM prompt with dedenting."""
    context = "User is a Python developer"
    question = "How do I use list comprehensions?"

    p = t_prompts.prompt(t"""
    You are a helpful programming assistant.

    Context: {context:ctx}

    Question: {question:q}

    Please provide a clear and concise answer with examples.
    """, dedent=True)

    result = str(p)
    assert "You are a helpful programming assistant." in result
    assert "Context: User is a Python developer" in result
    assert "Question: How do I use list comprehensions?" in result
    assert not result.startswith(" ")
    assert not result.endswith("\n")


def test_realistic_nested_conversation():
    """Test nested prompts representing conversation with dedenting."""
    system = t_prompts.prompt(t"""
    You are a helpful assistant.
    Always be polite and concise.
    """, dedent=True)

    user_msg = "Hello!"

    conversation = t_prompts.prompt(t"""
    System: {system:sys}

    User: {user_msg:user}
    """, dedent=True)

    result = str(conversation)
    assert "System: You are a helpful assistant." in result
    assert "User: Hello!" in result


def test_realistic_multi_section_prompt():
    """Test a multi-section prompt with dedenting."""
    task = "translate to French"
    examples = [
        t_prompts.prompt(t"English: {eng:eng} -> French: {fr:fr}")
        for eng, fr in [("hello", "bonjour"), ("goodbye", "au revoir")]
    ]

    p = t_prompts.prompt(t"""
    Task: {task:t}

    Examples:
    {examples:ex}

    Now translate the following:
    """, dedent=True)

    result = str(p)
    assert result.startswith("Task:")
    assert "Examples:" in result
    assert "English:" in result
    assert not result.endswith("\n")


# =============================================================================
# Default Behavior Tests
# =============================================================================


def test_default_trims_enabled_dedent_disabled():
    """Test that default behavior has trims ON and dedent OFF."""
    p = t_prompts.prompt(t"""
    Hello
    """)

    # Trims applied by default, but no dedenting
    # So indentation is preserved but leading/trailing lines removed
    assert str(p) == "    Hello"


def test_explicit_defaults():
    """Test explicitly setting all defaults."""
    p = t_prompts.prompt(t"""
    Hello
    """, dedent=False, trim_leading=True, trim_empty_leading=True, trim_trailing=True)

    # Should be same as default
    assert str(p) == "    Hello"


def test_dedent_only_no_trims():
    """Test dedent without trims."""
    p = t_prompts.prompt(t"""
    Hello
    """, dedent=True, trim_leading=False, trim_empty_leading=False, trim_trailing=False)

    # First line not removed, so dedenting considers it
    result = str(p)
    assert result.startswith("\n")
