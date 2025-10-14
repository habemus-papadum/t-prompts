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
    """Test that StructuredInterpolation preserves all metadata."""
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
