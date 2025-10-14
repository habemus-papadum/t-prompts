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
    assert "tree" in data
    assert "id_to_path" in data
    assert isinstance(data["tree"], list)
    assert isinstance(data["id_to_path"], dict)

    # Should have 5 elements: static "", interp x, static " ", interp y, static ""
    assert len(data["tree"]) == 5

    # Check element types
    assert data["tree"][0]["type"] == "static"
    assert data["tree"][1]["type"] == "interpolation"
    assert data["tree"][2]["type"] == "static"
    assert data["tree"][3]["type"] == "interpolation"
    assert data["tree"][4]["type"] == "static"

    # Check interpolation values
    assert data["tree"][1]["key"] == "x"
    assert data["tree"][1]["value"] == "X"
    assert data["tree"][3]["key"] == "y"
    assert data["tree"][3]["value"] == "Y"


def test_to_json_with_conversion():
    """Test toJSON() preserves conversion metadata."""
    text = "hello"

    p = t_prompts.prompt(t"{text!r:t}")

    data = p.toJSON()

    # Find the interpolation element
    interp = [e for e in data["tree"] if e["type"] == "interpolation"][0]

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

    # Should have elements from both prompts
    # Outer: static "", interp o, static " ", nested_prompt, static ""
    # Inner (nested under nested_prompt): static "", interp i, static ""
    assert len(data["tree"]) > 5

    # Find the nested prompt element
    nested_elem = [e for e in data["tree"] if e["type"] == "nested_prompt"][0]
    assert nested_elem["key"] == "nested"
    assert "prompt_id" in nested_elem

    # Check that nested elements have correct paths
    nested_elem_path = data["id_to_path"][nested_elem["id"]]
    # Elements after the nested prompt should have paths starting with nested_elem_path
    nested_children = [e for e in data["tree"]
                      if e["id"] in data["id_to_path"]
                      and data["id_to_path"][e["id"]][:len(nested_elem_path)] == nested_elem_path
                      and e["id"] != nested_elem["id"]]
    assert len(nested_children) > 0


def test_to_json_deeply_nested():
    """Test toJSON() with multiple nesting levels."""
    a = "A"
    p1 = t_prompts.prompt(t"{a:a}")
    p2 = t_prompts.prompt(t"{p1:p1}")
    p3 = t_prompts.prompt(t"{p2:p2}")

    data = p3.toJSON()

    # Should have nested_prompt elements
    nested_prompts = [e for e in data["tree"] if e["type"] == "nested_prompt"]
    assert len(nested_prompts) == 2  # p2 and p1

    # Find the innermost interpolation
    innermost = [e for e in data["tree"]
                if e["type"] == "interpolation" and e["key"] == "a"][0]
    assert innermost["value"] == "A"

    # Check path depth - innermost element should have longer path
    innermost_path = data["id_to_path"][innermost["id"]]
    assert len(innermost_path) > 2  # Should be nested at least 2 levels deep


def test_to_json_with_list():
    """Test toJSON() with ListInterpolation."""
    item1 = t_prompts.prompt(t"Item 1")
    item2 = t_prompts.prompt(t"Item 2")
    items = [item1, item2]
    p = t_prompts.prompt(t"List: {items:items}")

    data = p.toJSON()

    # Find the list element
    list_elem = [e for e in data["tree"] if e["type"] == "list"][0]
    assert list_elem["key"] == "items"
    assert "item_ids" in list_elem
    assert len(list_elem["item_ids"]) == 2

    # Check that item IDs match actual prompts
    assert list_elem["item_ids"][0] == item1.id
    assert list_elem["item_ids"][1] == item2.id


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
    list_elem = [e for e in data["tree"] if e["type"] == "list"][0]
    assert len(list_elem["item_ids"]) == 2

    # Find interpolations from nested items
    interpolations = [e for e in data["tree"]
                     if e["type"] == "interpolation" and e["key"] == "v"]
    assert len(interpolations) == 2
    assert interpolations[0]["value"] == "first"
    assert interpolations[1]["value"] == "second"


def test_to_json_with_separator():
    """Test toJSON() preserves separator in list interpolations."""
    items = [t_prompts.prompt(t"A"), t_prompts.prompt(t"B")]
    p = t_prompts.prompt(t"{items:items:sep= | }")

    data = p.toJSON()

    list_elem = [e for e in data["tree"] if e["type"] == "list"][0]
    assert list_elem["separator"] == " | "


def test_to_json_with_render_hints():
    """Test toJSON() preserves render hints."""
    content = "test"
    p = t_prompts.prompt(t"{content:c:xml=data:header=Section}")

    data = p.toJSON()

    interp = [e for e in data["tree"] if e["type"] == "interpolation"][0]
    assert interp["render_hints"] == "xml=data:header=Section"


def test_to_json_id_to_path_correctness():
    """Test that id_to_path mapping is correct."""
    x = "X"
    y = "Y"
    p = t_prompts.prompt(t"{x:x} {y:y}")

    data = p.toJSON()

    # Each element ID should map to its index in the tree
    for idx, element in enumerate(data["tree"]):
        path = data["id_to_path"][element["id"]]
        assert path == [idx]


def test_to_json_nested_id_to_path():
    """Test id_to_path for nested prompts."""
    inner = "inner"
    p_inner = t_prompts.prompt(t"{inner:i}")
    p_outer = t_prompts.prompt(t"{p_inner:p}")

    data = p_outer.toJSON()

    # Find the nested prompt element
    nested_elem = [e for e in data["tree"] if e["type"] == "nested_prompt"][0]
    nested_path = data["id_to_path"][nested_elem["id"]]

    # Find elements that are children of the nested prompt
    # They should have paths that start with nested_path
    for element in data["tree"]:
        elem_path = data["id_to_path"][element["id"]]
        if element["id"] != nested_elem["id"] and len(elem_path) > len(nested_path):
            # Check if this element is under the nested prompt
            if elem_path[:len(nested_path)] == nested_path:
                # This is a child - verify it comes after the nested prompt in tree
                assert data["tree"].index(element) > data["tree"].index(nested_elem)


def test_to_json_source_location():
    """Test that source location is included when available."""
    x = "X"
    p = t_prompts.prompt(t"{x:x}")

    data = p.toJSON()

    interp = [e for e in data["tree"] if e["type"] == "interpolation"][0]

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

    interp = [e for e in data["tree"] if e["type"] == "interpolation"][0]
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
    assert len(data["tree"]) == 1
    assert data["tree"][0]["type"] == "static"
    assert data["tree"][0]["value"] == "Just static text"


def test_to_json_empty_list():
    """Test toJSON() with an empty list."""
    items = []
    p = t_prompts.prompt(t"Items: {items:items}")

    data = p.toJSON()

    list_elem = [e for e in data["tree"] if e["type"] == "list"][0]
    assert list_elem["item_ids"] == []


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
    image_elem = [e for e in data["tree"] if e["type"] == "image"][0]
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
    a_elem = [e for e in data["tree"] if e.get("key") == "a"][0]
    b_elem = [e for e in data["tree"] if e.get("key") == "b"][0]
    c_elem = [e for e in data["tree"] if e.get("key") == "c"][0]

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

    # Check all types are present
    types = {e["type"] for e in data["tree"]}
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

    interp = [e for e in data["tree"] if e["type"] == "interpolation"][0]
    assert interp["format_spec"] == "custom_key:hint1:hint2"
    assert interp["key"] == "custom_key"
    assert interp["render_hints"] == "hint1:hint2"
