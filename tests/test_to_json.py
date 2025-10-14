"""Tests for toJSON() method."""

import json

import t_prompts


def test_to_json_simple():
    """Test toJSON() with simple interpolations."""
    x = "X"
    y = "Y"

    p = t_prompts.prompt(t"{x:x} {y:y}")

    data = p.toJSON()

    # Check structure
    assert "prompt_id" in data
    assert "children" in data
    assert isinstance(data["prompt_id"], str)
    assert isinstance(data["children"], list)

    # Should have 5 children: static "", interp x, static " ", interp y, static ""
    assert len(data["children"]) == 5

    # Check element types
    assert data["children"][0]["type"] == "static"
    assert data["children"][1]["type"] == "interpolation"
    assert data["children"][2]["type"] == "static"
    assert data["children"][3]["type"] == "interpolation"
    assert data["children"][4]["type"] == "static"

    # Check parent_id references
    for child in data["children"]:
        assert child["parent_id"] == data["prompt_id"]

    # Check interpolation values
    assert data["children"][1]["key"] == "x"
    assert data["children"][1]["value"] == "X"
    assert data["children"][3]["key"] == "y"
    assert data["children"][3]["value"] == "Y"


def test_to_json_with_conversion():
    """Test toJSON() preserves conversion metadata."""
    text = "hello"

    p = t_prompts.prompt(t"{text!r:t}")

    data = p.toJSON()

    # Find the interpolation element
    interp = [e for e in data["children"] if e["type"] == "interpolation"][0]

    assert interp["conversion"] == "r"
    assert interp["expression"] == "text"
    assert interp["key"] == "t"
    assert interp["value"] == "hello"


def test_to_json_nested():
    """Test toJSON() with nested prompts."""
    inner = "inner_value"
    outer = "outer_value"

    p_inner = t_prompts.prompt(t"{inner:i}")
    p_outer = t_prompts.prompt(t"{outer:o} {p_inner:nested}")

    data = p_outer.toJSON()

    # Outer should have 5 children: static "", interp o, static " ", nested_prompt, static ""
    assert len(data["children"]) == 5

    # Find the nested prompt element
    nested_elem = [e for e in data["children"] if e["type"] == "nested_prompt"][0]
    assert nested_elem["key"] == "nested"
    assert "prompt_id" in nested_elem
    assert nested_elem["prompt_id"] == p_inner.id

    # Nested prompt should have children array
    assert "children" in nested_elem
    assert isinstance(nested_elem["children"], list)

    # Inner prompt has 3 children: static "", interp i, static ""
    assert len(nested_elem["children"]) == 3

    # Find the interpolation in nested children
    nested_interp = [e for e in nested_elem["children"] if e["type"] == "interpolation"][0]
    assert nested_interp["key"] == "i"
    assert nested_interp["value"] == "inner_value"

    # Check parent_id references - nested children should reference nested_elem
    for child in nested_elem["children"]:
        assert child["parent_id"] == nested_elem["id"]


def test_to_json_deeply_nested():
    """Test toJSON() with multiple nesting levels."""
    a = "A"
    p1 = t_prompts.prompt(t"{a:a}")
    p2 = t_prompts.prompt(t"{p1:p1}")
    p3 = t_prompts.prompt(t"{p2:p2}")

    data = p3.toJSON()

    # p3 should have 3 children: static "", nested_prompt (p2), static ""
    assert len(data["children"]) == 3

    # Find p2 nested prompt
    p2_elem = [e for e in data["children"] if e["type"] == "nested_prompt"][0]
    assert p2_elem["key"] == "p2"
    assert p2_elem["prompt_id"] == p2.id
    assert "children" in p2_elem

    # p2 should have 3 children: static "", nested_prompt (p1), static ""
    assert len(p2_elem["children"]) == 3
    p1_elem = [e for e in p2_elem["children"] if e["type"] == "nested_prompt"][0]
    assert p1_elem["key"] == "p1"
    assert p1_elem["prompt_id"] == p1.id
    assert "children" in p1_elem

    # p1 should have 3 children: static "", interpolation (a), static ""
    assert len(p1_elem["children"]) == 3
    innermost = [e for e in p1_elem["children"] if e["type"] == "interpolation"][0]
    assert innermost["key"] == "a"
    assert innermost["value"] == "A"

    # Verify parent_id chain
    assert p2_elem["parent_id"] == data["prompt_id"]
    assert p1_elem["parent_id"] == p2_elem["id"]
    assert innermost["parent_id"] == p1_elem["id"]


def test_to_json_with_list():
    """Test toJSON() with ListInterpolation."""
    item1 = t_prompts.prompt(t"Item 1")
    item2 = t_prompts.prompt(t"Item 2")
    items = [item1, item2]
    p = t_prompts.prompt(t"List: {items:items}")

    data = p.toJSON()

    # Find the list element
    list_elem = [e for e in data["children"] if e["type"] == "list"][0]
    assert list_elem["key"] == "items"
    assert "children" in list_elem
    assert len(list_elem["children"]) == 2

    # Check that each child has prompt_id and children
    assert list_elem["children"][0]["prompt_id"] == item1.id
    assert "children" in list_elem["children"][0]
    assert list_elem["children"][1]["prompt_id"] == item2.id
    assert "children" in list_elem["children"][1]


def test_to_json_list_with_nested_prompts():
    """Test toJSON() with nested prompts inside a list."""
    val1 = "first"
    val2 = "second"
    inner1 = t_prompts.prompt(t"Value: {val1:v}")
    inner2 = t_prompts.prompt(t"Value: {val2:v}")
    items = [inner1, inner2]
    p = t_prompts.prompt(t"{items:list}")

    data = p.toJSON()

    # Find list element
    list_elem = [e for e in data["children"] if e["type"] == "list"][0]
    assert len(list_elem["children"]) == 2

    # Navigate into first item's children
    item1_children = list_elem["children"][0]["children"]
    interp1 = [e for e in item1_children if e["type"] == "interpolation"][0]
    assert interp1["key"] == "v"
    assert interp1["value"] == "first"

    # Navigate into second item's children
    item2_children = list_elem["children"][1]["children"]
    interp2 = [e for e in item2_children if e["type"] == "interpolation"][0]
    assert interp2["key"] == "v"
    assert interp2["value"] == "second"


def test_to_json_with_separator():
    """Test toJSON() preserves separator in list interpolations."""
    items = [t_prompts.prompt(t"A"), t_prompts.prompt(t"B")]
    p = t_prompts.prompt(t"{items:items:sep= | }")

    data = p.toJSON()

    list_elem = [e for e in data["children"] if e["type"] == "list"][0]
    assert list_elem["separator"] == " | "


def test_to_json_with_render_hints():
    """Test toJSON() preserves render hints."""
    content = "test"
    p = t_prompts.prompt(t"{content:c:xml=data:header=Section}")

    data = p.toJSON()

    interp = [e for e in data["children"] if e["type"] == "interpolation"][0]
    assert interp["render_hints"] == "xml=data:header=Section"


def test_to_json_source_location():
    """Test that source location is included when available."""
    x = "X"
    p = t_prompts.prompt(t"{x:x}")

    data = p.toJSON()

    interp = [e for e in data["children"] if e["type"] == "interpolation"][0]

    # Source location might be None or a dict depending on capture_source_location
    if interp["source_location"] is not None:
        assert "filename" in interp["source_location"]
        assert "filepath" in interp["source_location"]
        assert "line" in interp["source_location"]


def test_to_json_no_source_location():
    """Test toJSON() when source location capture is disabled."""
    x = "X"
    p = t_prompts.prompt(t"{x:x}", capture_source_location=False)

    data = p.toJSON()

    interp = [e for e in data["children"] if e["type"] == "interpolation"][0]
    assert interp["source_location"] is None


def test_to_json_json_serializable():
    """Test that toJSON() output is JSON-serializable."""
    x = "X"
    y = "Y"
    p_inner = t_prompts.prompt(t"{x:x}")
    p_outer = t_prompts.prompt(t"{y:y} {p_inner:nested}")

    data = p_outer.toJSON()

    # Should be JSON-serializable
    json_str = json.dumps(data)
    assert json_str
    parsed = json.loads(json_str)
    assert parsed == data


def test_to_json_empty_prompt():
    """Test toJSON() with a prompt containing only static text."""
    p = t_prompts.prompt(t"Just static text")

    data = p.toJSON()

    # Should have 1 static element
    assert len(data["children"]) == 1
    assert data["children"][0]["type"] == "static"
    assert data["children"][0]["value"] == "Just static text"


def test_to_json_empty_list():
    """Test toJSON() with an empty list."""
    items = []
    p = t_prompts.prompt(t"Items: {items:items}")

    data = p.toJSON()

    list_elem = [e for e in data["children"] if e["type"] == "list"][0]
    assert list_elem["children"] == []


def test_to_json_with_image():
    """Test toJSON() with ImageInterpolation (if PIL available)."""
    try:
        from PIL import Image
    except ImportError:
        # Skip test if PIL not available
        return

    # Create a minimal image
    img = Image.new("RGB", (10, 10), color="red")
    p = t_prompts.prompt(t"Image: {img:img}")

    data = p.toJSON()

    # Find the image element
    image_elem = [e for e in data["children"] if e["type"] == "image"][0]
    assert image_elem["key"] == "img"
    assert "image_data" in image_elem

    # Check image metadata
    image_data = image_elem["image_data"]
    assert "base64_data" in image_data
    assert "format" in image_data
    assert "width" in image_data
    assert "height" in image_data
    assert "mode" in image_data
    assert image_data["width"] == 10
    assert image_data["height"] == 10
    assert image_data["mode"] == "RGB"


def test_to_json_element_indices():
    """Test that element indices are preserved in toJSON()."""
    a = "A"
    b = "B"
    c = "C"

    p = t_prompts.prompt(t"{a:a} {b:b} {c:c}")

    data = p.toJSON()

    # Element indices should match original positions
    # Element sequence: "" (0), a (1), " " (2), b (3), " " (4), c (5), "" (6)
    a_elem = [e for e in data["children"] if e.get("key") == "a"][0]
    b_elem = [e for e in data["children"] if e.get("key") == "b"][0]
    c_elem = [e for e in data["children"] if e.get("key") == "c"][0]

    assert a_elem["index"] == 1
    assert b_elem["index"] == 3
    assert c_elem["index"] == 5


def test_to_json_all_element_types():
    """Test toJSON() with all element types in one prompt."""
    try:
        from PIL import Image
        has_pil = True
    except ImportError:
        has_pil = False

    val = "value"
    nested = t_prompts.prompt(t"nested")
    items = [t_prompts.prompt(t"item1"), t_prompts.prompt(t"item2")]

    if has_pil:
        img = Image.new("RGB", (5, 5))
        p = t_prompts.prompt(t"Static {val:v} {nested:n} {items:items} {img:img}")
    else:
        p = t_prompts.prompt(t"Static {val:v} {nested:n} {items:items}")

    data = p.toJSON()

    # Helper function to collect types recursively
    def collect_types(children):
        types = set()
        for elem in children:
            types.add(elem["type"])
            if "children" in elem:
                if isinstance(elem["children"], list):
                    # Could be element children or list item children
                    if elem["children"] and "prompt_id" in elem["children"][0]:
                        # List items - recurse into their children
                        for item in elem["children"]:
                            types.update(collect_types(item["children"]))
                    else:
                        # Regular element children
                        types.update(collect_types(elem["children"]))
        return types

    # Check all types are present
    types = collect_types(data["children"])
    assert "static" in types
    assert "interpolation" in types
    assert "nested_prompt" in types
    assert "list" in types
    if has_pil:
        assert "image" in types


def test_to_json_format_spec_preservation():
    """Test that format_spec is preserved correctly."""
    x = "X"
    p = t_prompts.prompt(t"{x:custom_key:hint1:hint2}")

    data = p.toJSON()

    interp = [e for e in data["children"] if e["type"] == "interpolation"][0]
    assert interp["format_spec"] == "custom_key:hint1:hint2"
    assert interp["key"] == "custom_key"
    assert interp["render_hints"] == "hint1:hint2"
