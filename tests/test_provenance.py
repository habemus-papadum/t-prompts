"""Tests for provenance tracking and export."""

import t_prompts


def test_navigation_chain_provenance():
    """Test that navigation chains preserve provenance."""
    instructions = "Always answer politely."
    foo = "bar"

    p = t_prompts.prompt(t"Obey {instructions:inst}")
    p2 = t_prompts.prompt(t"bazz {foo} {p}")

    # Navigate and check provenance
    inst_node = p2["p"]["inst"]
    assert inst_node.expression == "instructions"
    assert inst_node.value == "Always answer politely."
    assert inst_node.key == "inst"


def test_interpolation_metadata():
    """Test that TextInterpolation preserves all metadata."""
    x = "X"

    p = t_prompts.prompt(t"{x!r:mykey}")

    node = p["mykey"]

    assert node.key == "mykey"
    assert node.expression == "x"
    assert node.conversion == "r"
    assert node.format_spec == "mykey"
    assert node.value == "X"
    # Index is now 1 (element 0 is empty static "", element 1 is interpolation)
    assert node.index == 1
    assert node.parent is p


def test_multiple_interpolation_indices():
    """Test that indices are correctly assigned."""
    a = "A"
    b = "B"
    c = "C"

    p = t_prompts.prompt(t"{a:a} {b:b} {c:c}")

    # Indices now track element positions (including statics)
    # Element sequence: "" (0), a (1), " " (2), b (3), " " (4), c (5), "" (6)
    assert p["a"].index == 1
    assert p["b"].index == 3
    assert p["c"].index == 5


def test_parent_reference():
    """Test that parent references work correctly."""
    x = "X"

    p = t_prompts.prompt(t"{x:x}")

    node = p["x"]
    assert node.parent is p


def test_nested_parent_reference():
    """Test parent references in nested prompts."""
    inner = "inner"
    p_inner = t_prompts.prompt(t"{inner:i}")
    p_outer = t_prompts.prompt(t"{p_inner:nested}")

    outer_node = p_outer["nested"]
    assert outer_node.parent is p_outer

    # The inner node's parent should be p_inner, not p_outer
    inner_node = outer_node["i"]
    assert inner_node.parent is p_inner


def test_parent_initially_none():
    """Test that parent is initially None for root prompts."""
    p = t_prompts.prompt(t"simple prompt")
    assert p.parent is None


def test_parent_set_by_nested_interpolation():
    """Test that nesting sets parent correctly."""
    inner = "inner"
    p_inner = t_prompts.prompt(t"{inner:i}")
    p_outer = t_prompts.prompt(t"{p_inner:nested}")

    # p_inner should have parent pointing to p_outer
    assert p_inner.parent is not None
    assert p_inner.parent is p_outer
    assert p_inner.key == "nested"
    # Can access the wrapper element via parent[key]
    assert p_inner.parent[p_inner.key] is p_outer["nested"]


def test_parent_set_by_list_interpolation():
    """Test that ListInterpolation sets parent for all items."""
    item1 = t_prompts.prompt(t"Item 1")
    item2 = t_prompts.prompt(t"Item 2")
    items = [item1, item2]
    p = t_prompts.prompt(t"{items:items}")

    # Both items should have parent pointing to p
    assert item1.parent is p
    assert item2.parent is p
    assert item1.key == 0  # List items use integer keys
    assert item2.key == 1


def test_prompt_reuse_error_nested():
    """Test that reusing a prompt in multiple locations raises error."""
    import pytest

    from t_prompts import PromptReuseError

    inner = "inner"
    p_inner = t_prompts.prompt(t"{inner:i}")

    # First nesting should work
    _p_outer1 = t_prompts.prompt(t"{p_inner:nested1}")  # noqa: F841

    # Second nesting should raise PromptReuseError
    with pytest.raises(PromptReuseError) as exc_info:
        _p_outer2 = t_prompts.prompt(t"{p_inner:nested2}")  # noqa: F841

    # Check error message is helpful
    assert "id=" in str(exc_info.value)
    assert "nested1" in str(exc_info.value)
    assert "nested2" in str(exc_info.value)
    assert "multiple locations" in str(exc_info.value)


def test_prompt_reuse_error_list_and_nested():
    """Test that using a prompt in both a list and elsewhere raises error."""
    import pytest

    from t_prompts import PromptReuseError

    item = t_prompts.prompt(t"Item")
    items = [item]

    # First use in list
    _p_list = t_prompts.prompt(t"{items:items}")  # noqa: F841

    # Second use as nested should raise error
    with pytest.raises(PromptReuseError) as exc_info:
        _p_nested = t_prompts.prompt(t"{item:nested}")  # noqa: F841

    assert "multiple locations" in str(exc_info.value)


def test_upward_traversal_from_leaf_to_root():
    """Test that we can traverse upward from a leaf element to the root."""
    inner_val = "inner"
    middle_val = "middle"

    # Create nested structure: root -> middle -> inner
    p_inner = t_prompts.prompt(t"{inner_val:i}")
    p_middle = t_prompts.prompt(t"{middle_val:m} {p_inner:nested_inner}")
    p_root = t_prompts.prompt(t"{p_middle:nested_middle}")

    # Start from the inner text interpolation and traverse up to root
    leaf_node = p_inner["i"]
    assert leaf_node.parent is p_inner

    # p_inner.parent should point to p_middle
    assert p_inner.parent is not None
    assert p_inner.parent is p_middle
    assert p_inner.key == "nested_inner"

    # p_middle.parent should point to p_root
    assert p_middle.parent is not None
    assert p_middle.parent is p_root
    assert p_middle.key == "nested_middle"

    # p_root should have no parent (it's the root)
    assert p_root.parent is None


def test_upward_traversal_from_list_item():
    """Test upward traversal from a prompt inside a list."""
    item_val = "item"
    p_item = t_prompts.prompt(t"{item_val:v}")
    items = [p_item]
    p_root = t_prompts.prompt(t"{items:items}")

    # Start from the item and traverse up
    leaf_node = p_item["v"]
    assert leaf_node.parent is p_item

    # p_item.parent should point to p_root
    assert p_item.parent is not None
    assert p_item.parent is p_root
    assert p_item.key == 0  # List items use integer keys

    # p_root should have no parent
    assert p_root.parent is None


def test_parent_with_deeply_nested_prompts():
    """Test parent with multiple levels of nesting."""
    a = "A"
    p1 = t_prompts.prompt(t"{a:a}")
    p2 = t_prompts.prompt(t"{p1:p1}")
    p3 = t_prompts.prompt(t"{p2:p2}")

    # Check parent chain
    assert p1.parent is not None
    assert p1.parent is p2
    assert p1.key == "p1"

    assert p2.parent is not None
    assert p2.parent is p3
    assert p2.key == "p2"

    assert p3.parent is None


def test_parent_element_error_message_quality():
    """Test that PromptReuseError provides helpful error information."""
    from t_prompts import PromptReuseError

    inner = "inner"
    p_inner = t_prompts.prompt(t"{inner:i}")
    _p_outer1 = t_prompts.prompt(t"{p_inner:first}")  # noqa: F841

    try:
        _p_outer2 = t_prompts.prompt(t"{p_inner:second}")  # noqa: F841
        assert False, "Should have raised PromptReuseError"
    except PromptReuseError as e:
        # Check that all important info is in the error
        assert e.prompt is p_inner
        assert e.current_parent.key == "first"
        assert e.new_parent.key == "second"
        error_msg = str(e)
        assert "first" in error_msg
        assert "second" in error_msg
        assert str(p_inner.id) in error_msg
