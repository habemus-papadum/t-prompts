"""Tests for provenance tracking and export."""

import json

import t_prompts


def test_to_values_simple():
    """Test to_values() with simple interpolations."""
    x = "X"
    y = "Y"

    p = t_prompts.prompt(t"{x:x} {y:y}")

    values = p.to_values()

    assert isinstance(values, dict)
    assert values == {"x": "X", "y": "Y"}


def test_to_values_with_conversion():
    """Test that to_values() includes conversion results."""
    text = "hello"

    p = t_prompts.prompt(t"{text!r:t}")

    values = p.to_values()

    # !r should be applied, so value should be "'hello'"
    assert values["t"] == "'hello'"


def test_to_values_nested():
    """Test to_values() with nested prompts."""
    inner = "inner"
    outer = "outer"

    p_inner = t_prompts.prompt(t"{inner:i}")
    p_outer = t_prompts.prompt(t"{outer:o} {p_inner:nested}")

    values = p_outer.to_values()

    assert values["o"] == "outer"
    assert isinstance(values["nested"], dict)
    assert values["nested"]["i"] == "inner"


def test_to_values_deeply_nested():
    """Test to_values() with multiple nesting levels."""
    a = "A"
    p1 = t_prompts.prompt(t"{a:a}")
    p2 = t_prompts.prompt(t"{p1:p1}")
    p3 = t_prompts.prompt(t"{p2:p2}")

    values = p3.to_values()

    assert values["p2"]["p1"]["a"] == "A"


def test_to_values_json_serializable():
    """Test that to_values() produces JSON-serializable output."""
    x = "X"
    y = "Y"

    p = t_prompts.prompt(t"{x:x} {y:y}")

    values = p.to_values()

    # Should be JSON-serializable
    json_str = json.dumps(values)
    assert json_str
    parsed = json.loads(json_str)
    assert parsed == values


def test_to_provenance_structure():
    """Test to_provenance() structure."""
    x = "X"

    p = t_prompts.prompt(t"before {x:x} after")

    prov = p.to_provenance()

    # Should have strings and nodes
    assert "strings" in prov
    assert "nodes" in prov

    # Strings should match template
    assert prov["strings"] == ["before ", " after"]

    # Nodes should have full metadata
    assert len(prov["nodes"]) == 1
    node_data = prov["nodes"][0]

    assert node_data["key"] == "x"
    assert node_data["expression"] == "x"
    assert node_data["conversion"] is None
    assert node_data["format_spec"] == "x"
    assert node_data["value"] == "X"
    # Index is now 1 because element 0 is the static "before "
    assert node_data["index"] == 1


def test_to_provenance_with_conversion():
    """Test that to_provenance() includes conversion metadata."""
    text = "hello"

    p = t_prompts.prompt(t"{text!r:t}")

    prov = p.to_provenance()

    node_data = prov["nodes"][0]
    assert node_data["conversion"] == "r"
    assert node_data["expression"] == "text"


def test_to_provenance_with_nested():
    """Test to_provenance() with nested prompts."""
    inner = "inner"
    outer = "outer"

    p_inner = t_prompts.prompt(t"{inner:i}")
    p_outer = t_prompts.prompt(t"{outer:o} {p_inner:nested}")

    prov = p_outer.to_provenance()

    assert len(prov["nodes"]) == 2

    # First node is outer
    assert prov["nodes"][0]["key"] == "o"
    assert prov["nodes"][0]["value"] == "outer"

    # Second node is nested prompt
    nested_data = prov["nodes"][1]
    assert nested_data["key"] == "nested"
    assert isinstance(nested_data["value"], dict)
    assert "strings" in nested_data["value"]
    assert "nodes" in nested_data["value"]

    # Check nested content
    nested_prov = nested_data["value"]
    assert nested_prov["nodes"][0]["key"] == "i"
    assert nested_prov["nodes"][0]["value"] == "inner"


def test_to_provenance_json_serializable():
    """Test that to_provenance() produces JSON-serializable output."""
    x = "X"
    y = "Y"

    p_inner = t_prompts.prompt(t"{x:x}")
    p_outer = t_prompts.prompt(t"{y:y} {p_inner:nested}")

    prov = p_outer.to_provenance()

    # Should be JSON-serializable
    json_str = json.dumps(prov)
    assert json_str
    parsed = json.loads(json_str)
    assert parsed == prov


def test_provenance_matches_source():
    """Test that provenance accurately reflects the source t-string."""
    instructions = "Be polite"
    context = "User is Alice"

    p = t_prompts.prompt(t"System: {instructions:inst} Context: {context:ctx}")

    prov = p.to_provenance()

    # Check strings match
    assert prov["strings"] == ["System: ", " Context: ", ""]

    # Check nodes match
    assert len(prov["nodes"]) == 2

    # First interpolation
    assert prov["nodes"][0]["expression"] == "instructions"
    assert prov["nodes"][0]["key"] == "inst"
    assert prov["nodes"][0]["format_spec"] == "inst"

    # Second interpolation
    assert prov["nodes"][1]["expression"] == "context"
    assert prov["nodes"][1]["key"] == "ctx"
    assert prov["nodes"][1]["format_spec"] == "ctx"


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


def test_provenance_with_empty_format_spec():
    """Test provenance when format_spec is empty (key comes from expression)."""
    foo = "FOO"

    p = t_prompts.prompt(t"{foo}")

    prov = p.to_provenance()

    node_data = prov["nodes"][0]
    assert node_data["key"] == "foo"
    assert node_data["expression"] == "foo"
    assert node_data["format_spec"] == ""


def test_provenance_roundtrip():
    """Test that provenance can be exported and contains all original info."""
    text = "hello"
    num = "42"

    p = t_prompts.prompt(t"Text: {text!r:t}, Num: {num:n}")

    # Export provenance
    prov = p.to_provenance()

    # Verify we can reconstruct the original structure from provenance
    assert len(prov["nodes"]) == 2
    assert prov["strings"] == ["Text: ", ", Num: ", ""]

    # Node 0
    assert prov["nodes"][0]["expression"] == "text"
    assert prov["nodes"][0]["conversion"] == "r"
    assert prov["nodes"][0]["key"] == "t"

    # Node 1
    assert prov["nodes"][1]["expression"] == "num"
    assert prov["nodes"][1]["conversion"] is None
    assert prov["nodes"][1]["key"] == "n"


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


def test_to_values_with_list_interpolation():
    """Test to_values() with ListInterpolation."""
    item1 = t_prompts.prompt(t"Item 1")
    item2 = t_prompts.prompt(t"Item 2")
    items = [item1, item2]
    p = t_prompts.prompt(t"List: {items:items}")

    values = p.to_values()

    assert "items" in values
    assert isinstance(values["items"], list)
    assert len(values["items"]) == 2
    # Each item should be a dict (since they're prompts)
    assert isinstance(values["items"][0], dict)
    assert isinstance(values["items"][1], dict)


def test_to_values_with_nested_prompts_in_list():
    """Test to_values() with nested prompts inside a list."""
    val1 = "first"
    val2 = "second"
    inner1 = t_prompts.prompt(t"Value: {val1:v}")
    inner2 = t_prompts.prompt(t"Value: {val2:v}")
    items = [inner1, inner2]
    p = t_prompts.prompt(t"{items:list}")

    values = p.to_values()

    # to_values() returns interpolation values, not full rendered text
    assert values == {
        "list": [
            {"v": "first"},
            {"v": "second"}
        ]
    }


def test_to_provenance_with_list_interpolation():
    """Test to_provenance() with ListInterpolation."""
    item1 = t_prompts.prompt(t"First")
    item2 = t_prompts.prompt(t"Second")
    items = [item1, item2]
    p = t_prompts.prompt(t"{items:items:header=My List}")

    prov = p.to_provenance()

    # Should have one node for the list
    assert len(prov["nodes"]) == 1
    node_data = prov["nodes"][0]

    assert node_data["key"] == "items"
    assert node_data["expression"] == "items"
    assert node_data["render_hints"] == "header=My List"
    assert isinstance(node_data["value"], list)
    assert len(node_data["value"]) == 2

    # Each item should have its own provenance
    assert "strings" in node_data["value"][0]
    assert "nodes" in node_data["value"][0]
    assert "strings" in node_data["value"][1]
    assert "nodes" in node_data["value"][1]


def test_to_provenance_with_image_interpolation():
    """Test to_provenance() with ImageInterpolation (if PIL available)."""
    try:
        from PIL import Image
    except ImportError:
        # Skip test if PIL not available
        return

    # Create a minimal image
    img = Image.new("RGB", (10, 10), color="red")
    p = t_prompts.prompt(t"Image: {img:img}")

    prov = p.to_provenance()

    # Should have one node for the image
    assert len(prov["nodes"]) == 1
    node_data = prov["nodes"][0]

    assert node_data["key"] == "img"
    assert node_data["expression"] == "img"
    # Image itself shouldn't be in provenance (not JSON serializable)


def test_parent_element_initially_none():
    """Test that parent_element is initially None."""
    p = t_prompts.prompt(t"simple prompt")
    assert p.parent_element is None


def test_parent_element_set_by_nested_interpolation():
    """Test that NestedPromptInterpolation sets parent_element."""
    inner = "inner"
    p_inner = t_prompts.prompt(t"{inner:i}")
    p_outer = t_prompts.prompt(t"{p_inner:nested}")

    # p_inner should have parent_element pointing to the NestedPromptInterpolation
    assert p_inner.parent_element is not None
    assert p_inner.parent_element is p_outer["nested"]
    assert p_inner.parent_element.key == "nested"


def test_parent_element_set_by_list_interpolation():
    """Test that ListInterpolation sets parent_element for all items."""
    item1 = t_prompts.prompt(t"Item 1")
    item2 = t_prompts.prompt(t"Item 2")
    items = [item1, item2]
    p = t_prompts.prompt(t"{items:items}")

    # Both items should have parent_element pointing to the ListInterpolation
    list_element = p["items"]
    assert item1.parent_element is list_element
    assert item2.parent_element is list_element
    assert item1.parent_element.key == "items"
    assert item2.parent_element.key == "items"


def test_prompt_reuse_error_nested():
    """Test that reusing a prompt in multiple NestedPromptInterpolations raises error."""
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


def test_prompt_reuse_same_list_allowed():
    """Test that the same prompt appearing twice in the same list is allowed.

    This is acceptable because both appearances share the same parent (ListInterpolation).
    The single-parent constraint is about preventing different parents, not
    multiple references from the same parent.
    """
    item = t_prompts.prompt(t"Item")
    items = [item, item]  # Same prompt twice

    # Should NOT raise error - same parent is OK (idempotent)
    p = t_prompts.prompt(t"{items:items}")

    # Both appearances point to the same parent
    assert item.parent_element is p["items"]
    assert item.parent_element.key == "items"


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


def test_set_parent_element_idempotent():
    """Test that setting the same parent multiple times is idempotent."""
    inner = "inner"
    p_inner = t_prompts.prompt(t"{inner:i}")
    p_outer = t_prompts.prompt(t"{p_inner:nested}")

    nested_element = p_outer["nested"]

    # Should not raise error when calling multiple times with same parent
    p_inner._set_parent_element(nested_element)
    p_inner._set_parent_element(nested_element)

    assert p_inner.parent_element is nested_element


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

    # p_inner.parent_element should be the NestedPromptInterpolation in p_middle
    assert p_inner.parent_element is not None
    assert p_inner.parent_element.key == "nested_inner"
    assert p_inner.parent_element.parent is p_middle

    # p_middle.parent_element should be the NestedPromptInterpolation in p_root
    assert p_middle.parent_element is not None
    assert p_middle.parent_element.key == "nested_middle"
    assert p_middle.parent_element.parent is p_root

    # p_root should have no parent_element (it's the root)
    assert p_root.parent_element is None


def test_upward_traversal_from_list_item():
    """Test upward traversal from a prompt inside a list."""
    item_val = "item"
    p_item = t_prompts.prompt(t"{item_val:v}")
    items = [p_item]
    p_root = t_prompts.prompt(t"{items:items}")

    # Start from the item and traverse up
    leaf_node = p_item["v"]
    assert leaf_node.parent is p_item

    # p_item.parent_element should be the ListInterpolation
    assert p_item.parent_element is not None
    assert p_item.parent_element.key == "items"
    assert isinstance(p_item.parent_element, t_prompts.ListInterpolation)
    assert p_item.parent_element.parent is p_root

    # p_root should have no parent_element
    assert p_root.parent_element is None


def test_parent_element_with_deeply_nested_prompts():
    """Test parent_element with multiple levels of nesting."""
    a = "A"
    p1 = t_prompts.prompt(t"{a:a}")
    p2 = t_prompts.prompt(t"{p1:p1}")
    p3 = t_prompts.prompt(t"{p2:p2}")

    # Check parent_element chain
    assert p1.parent_element is not None
    assert p1.parent_element.key == "p1"
    assert p1.parent_element.parent is p2

    assert p2.parent_element is not None
    assert p2.parent_element.key == "p2"
    assert p2.parent_element.parent is p3

    assert p3.parent_element is None


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
