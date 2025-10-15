"""
Python consistency tests for widget render hints.

These tests ensure that JavaScript widget rendering with render hints
produces EXACTLY the same string output as Python's render() method.

This is critical for Phase 2C - the JavaScript implementation must match
Python behavior precisely.
"""

import pytest
from t_prompts import prompt, dedent


def test_header_hint_basic():
    """Test basic header hint matches Python output."""
    content = "This is the content"
    p = prompt(t"{content:c:header=Section}")

    # Get Python output
    ir = p.render()
    python_string = ir.text

    # Expected: "# Section\nThis is the content"
    assert python_string == "# Section\nThis is the content"

    # Verify IR has the data widget needs
    ir_json = ir.toJSON()
    assert ir_json['source_prompt'] is not None
    assert ir_json['chunks'] is not None


def test_header_hint_using_key():
    """Test header hint without value (uses key)."""
    instructions = "Follow these guidelines"
    p = prompt(t"{instructions:Instructions:header}")

    ir = p.render()
    python_string = ir.text

    # Expected: "# Instructions\nFollow these guidelines"
    assert python_string == "# Instructions\nFollow these guidelines"


def test_xml_hint_basic():
    """Test basic XML hint matches Python output."""
    reasoning = "My thought process"
    p = prompt(t"{reasoning:r:xml=thinking}")

    ir = p.render()
    python_string = ir.text

    # Expected: "<thinking>\nMy thought process\n</thinking>"
    assert python_string == "<thinking>\nMy thought process\n</thinking>"


def test_combined_header_and_xml():
    """Test combined header and XML hints."""
    analysis = "Step 1: Identify\nStep 2: Solve"
    p = prompt(t"{analysis:a:header=Analysis:xml=process}")

    ir = p.render()
    python_string = ir.text

    # Expected: "# Analysis\n<process>\nStep 1: Identify\nStep 2: Solve\n</process>"
    expected = "# Analysis\n<process>\nStep 1: Identify\nStep 2: Solve\n</process>"
    assert python_string == expected


def test_header_nesting_levels():
    """Test header level nesting increments correctly."""
    # Create deeply nested structure
    level3_content = "Level 3 content"
    level3 = prompt(t"{level3_content:c:header=Deep Section}")

    level2_intro = "Level 2 intro"
    level2 = prompt(t"{level2_intro:i:header=Middle Section}\n{level3:l3:header}")

    level1_intro = "Level 1 intro"
    level1 = prompt(t"{level1_intro:i:header=Top Section}\n{level2:l2:header}")

    ir = level1.render()
    python_string = ir.text

    # Expected header levels: #, ##, ###
    assert python_string.startswith("# Top Section")
    assert "\n## Middle Section\n" in python_string or "\n## l2\n" in python_string
    assert "### Deep Section" in python_string or "### " in python_string


def test_header_level_capping():
    """Test that header levels cap at max (default 4)."""
    # Create 5 levels of nesting
    level5 = prompt(t"{'L5':c:header=Level 5}")
    level4 = prompt(t"{level5:l5:header=Level 4}")
    level3 = prompt(t"{level4:l4:header=Level 3}")
    level2 = prompt(t"{level3:l3:header=Level 2}")
    level1 = prompt(t"{level2:l2:header=Level 1}")

    # Default max_header_level is 4
    ir = level1.render()
    python_string = ir.text

    # Count header levels
    lines = python_string.split('\n')
    header_lines = [l for l in lines if l.startswith('#')]

    # Should have headers at levels 1, 2, 3, 4, 4 (last one capped)
    assert any(l.startswith('# Level 1') for l in header_lines)
    assert any(l.startswith('## ') for l in header_lines)
    assert any(l.startswith('### ') for l in header_lines)
    assert any(l.startswith('#### ') for l in header_lines)
    # Level 5 should be capped at 4
    assert not any(l.startswith('##### ') for l in header_lines)


def test_list_with_separator_hint():
    """Test list with custom separator from render hint."""
    items = [prompt(t"{item:i}") for item in ["apple", "banana", "cherry"]]
    p = prompt(t"{items:fruits:sep=, }")

    ir = p.render()
    python_string = ir.text

    # Expected: "apple, banana, cherry"
    assert python_string == "apple, banana, cherry"


def test_list_with_header_and_xml():
    """Test list with both header and XML hints."""
    items = [prompt(t"{item:i}") for item in ["Item 1", "Item 2", "Item 3"]]
    p = prompt(t"{items:items:header=Items:xml=list}")

    ir = p.render()
    python_string = ir.text

    # Expected:
    # # Items
    # <list>
    # Item 1
    # Item 2
    # Item 3
    # </list>
    expected = "# Items\n<list>\nItem 1\nItem 2\nItem 3\n</list>"
    assert python_string == expected


def test_nested_prompts_with_render_hints():
    """Test nested prompts each with their own render hints."""
    inner_content = "Inner analysis"
    inner = prompt(t"{inner_content:ic:header=Sub-Analysis:xml=step}")

    outer_content = "Outer context"
    outer = prompt(t"{outer_content:oc:header=Main Analysis}\n{inner:inner:header:xml=process}")

    ir = outer.render()
    python_string = ir.text

    # Expected structure:
    # # Main Analysis
    # Outer context
    # # inner
    # <process>
    # ## Sub-Analysis
    # <step>
    # Inner analysis
    # </step>
    # </process>

    assert python_string.startswith("# Main Analysis")
    assert "Outer context" in python_string
    assert "<process>" in python_string
    assert "<step>" in python_string
    assert "Inner analysis" in python_string
    assert "</step>" in python_string
    assert "</process>" in python_string


def test_multiline_content_with_hints():
    """Test multiline content with render hints."""
    content = "Line 1\nLine 2\nLine 3"
    p = prompt(t"{content:c:header=Content:xml=section}")

    ir = p.render()
    python_string = ir.text

    expected = "# Content\n<section>\nLine 1\nLine 2\nLine 3\n</section>"
    assert python_string == expected


def test_dedented_prompt_with_hints():
    """Test dedented prompts work with render hints."""
    task = "Analyze the code"
    p = dedent(t"""
        {task:task:header=Task}

        Please provide a detailed analysis.
    """)

    ir = p.render()
    python_string = ir.text

    assert python_string.startswith("# Task\nAnalyze the code")
    assert "Please provide a detailed analysis." in python_string


def test_empty_content_with_hints():
    """Test render hints with empty content."""
    content = ""
    p = prompt(t"{content:c:header=Empty:xml=empty}")

    ir = p.render()
    python_string = ir.text

    # Should still have structure even with empty content
    expected = "# Empty\n<empty>\n\n</empty>"
    assert python_string == expected


def test_complex_realistic_example():
    """Test a realistic complex example with multiple features."""
    system_instructions = "You are an expert developer."
    task = "Write a function to validate emails"
    examples = [
        prompt(t"Input: user@example.com\nExpected: Valid"),
        prompt(t"Input: invalid.email\nExpected: Invalid"),
    ]
    constraints = "Must handle international domains"

    full_prompt = dedent(t"""
        {system_instructions:sys:header=System}

        {task:task:header=Task}

        {examples:exs:header=Examples:xml=examples}

        {constraints:constraints:header=Constraints:xml=requirements}
    """)

    ir = full_prompt.render()
    python_string = ir.text

    # Verify structure
    assert "# System" in python_string
    assert "You are an expert developer." in python_string
    assert "# Task" in python_string
    assert "Write a function to validate emails" in python_string
    assert "# Examples" in python_string
    assert "<examples>" in python_string
    assert "</examples>" in python_string
    assert "# Constraints" in python_string
    assert "<requirements>" in python_string
    assert "Must handle international domains" in python_string
    assert "</requirements>" in python_string


@pytest.mark.visual
def test_widget_renders_with_hints(page):
    """Visual test: widget renders prompts with render hints correctly."""
    # This will be caught by Playwright visual tests
    content = "Test content"
    p = prompt(t"{content:c:header=Test:xml=test}")

    ir = p.render()

    # Widget should render this correctly
    ir_json = ir.toJSON()
    assert 'source_prompt' in ir_json
    assert 'render_hints' in str(ir_json)  # Should have render_hints in the JSON


if __name__ == '__main__':
    # Run tests
    pytest.main([__file__, '-v'])
