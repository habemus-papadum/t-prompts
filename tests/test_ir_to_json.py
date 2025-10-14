"""Tests for IntermediateRepresentation.toJSON() method."""

import json

import t_prompts


def test_ir_to_json_simple():
    """Test toJSON() with simple text-only IR."""
    x = "X"
    y = "Y"

    p = t_prompts.prompt(t"{x:x} {y:y}")
    ir = p.render()

    data = ir.toJSON()

    # Check top-level structure
    assert "ir_id" in data
    assert "source_prompt" in data
    assert "chunks" in data
    assert "chunk_id_to_index" in data
    assert "source_map" in data

    assert isinstance(data["ir_id"], str)
    assert isinstance(data["source_prompt"], dict)
    assert isinstance(data["chunks"], list)
    assert isinstance(data["chunk_id_to_index"], dict)
    assert isinstance(data["source_map"], list)

    # Should have one text chunk
    assert len(data["chunks"]) == 1
    assert data["chunks"][0]["type"] == "text"
    assert data["chunks"][0]["text"] == "X Y"
    assert data["chunks"][0]["chunk_index"] == 0

    # Check chunk_id_to_index mapping
    chunk_id = data["chunks"][0]["id"]
    assert chunk_id in data["chunk_id_to_index"]
    assert data["chunk_id_to_index"][chunk_id] == 0


def test_ir_to_json_source_prompt():
    """Test that source_prompt is serialized using hierarchical toJSON()."""
    x = "value"
    p = t_prompts.prompt(t"{x:x}")
    ir = p.render()

    data = ir.toJSON()

    # Source prompt should have hierarchical structure
    assert "prompt_id" in data["source_prompt"]
    assert "children" in data["source_prompt"]
    assert data["source_prompt"]["prompt_id"] == p.id


def test_ir_to_json_source_map_bidirectional():
    """Test that source_map includes both element_id and chunk_id for bidirectional lookup."""
    name = "Alice"
    p = t_prompts.prompt(t"Name: {name:n}")
    ir = p.render()

    data = ir.toJSON()

    # Each source map entry should have both element_id and chunk_id
    for span in data["source_map"]:
        assert "element_id" in span
        assert "chunk_id" in span
        assert "chunk_index" in span
        assert isinstance(span["element_id"], str)
        assert isinstance(span["chunk_id"], str)

    # Find the interpolation span
    interp_spans = [s for s in data["source_map"] if s["element_type"] == "interpolation"]
    assert len(interp_spans) == 1
    assert interp_spans[0]["key"] == "n"

    # The chunk_id should match the chunk at that chunk_index
    chunk_index = interp_spans[0]["chunk_index"]
    chunk_id = interp_spans[0]["chunk_id"]
    assert data["chunks"][chunk_index]["id"] == chunk_id


def test_ir_to_json_source_map_complete():
    """Test that source_map includes all required fields."""
    x = "test"
    p = t_prompts.prompt(t"Value: {x:x}")
    ir = p.render()

    data = ir.toJSON()

    # Check that all spans have required fields
    required_fields = ["start", "end", "key", "path", "element_type", "chunk_index", "chunk_id", "element_id"]
    for span in data["source_map"]:
        for field in required_fields:
            assert field in span, f"Missing field {field} in span"

    # Check path is a list (converted from tuple)
    for span in data["source_map"]:
        assert isinstance(span["path"], list)


def test_ir_to_json_nested_prompts():
    """Test toJSON() with nested prompts."""
    inner = "inner_value"
    outer = "outer_value"

    p_inner = t_prompts.prompt(t"{inner:i}")
    p_outer = t_prompts.prompt(t"{outer:o} {p_inner:nested}")

    ir = p_outer.render()
    data = ir.toJSON()

    # Check that source_prompt includes nested structure
    assert "source_prompt" in data
    source_prompt = data["source_prompt"]

    # Find nested prompt in children
    nested_prompts = [
        child for child in source_prompt["children"]
        if child.get("type") == "nested_prompt"
    ]
    assert len(nested_prompts) == 1
    assert nested_prompts[0]["key"] == "nested"
    assert "children" in nested_prompts[0]


def test_ir_to_json_with_list():
    """Test toJSON() with list interpolations."""
    items = [t_prompts.prompt(t"Item 1"), t_prompts.prompt(t"Item 2")]
    p = t_prompts.prompt(t"List: {items:items}")

    ir = p.render()
    data = ir.toJSON()

    # Check source_prompt includes list structure
    source_prompt = data["source_prompt"]
    list_elems = [
        child for child in source_prompt["children"]
        if child.get("type") == "list"
    ]
    assert len(list_elems) == 1
    assert list_elems[0]["key"] == "items"
    assert len(list_elems[0]["children"]) == 2


def test_ir_to_json_json_serializable():
    """Test that toJSON() output is JSON-serializable."""
    x = "X"
    y = "Y"
    p_inner = t_prompts.prompt(t"{x:x}")
    p_outer = t_prompts.prompt(t"{y:y} {p_inner:nested}")

    ir = p_outer.render()
    data = ir.toJSON()

    # Should be JSON-serializable
    json_str = json.dumps(data)
    assert json_str
    parsed = json.loads(json_str)
    assert parsed == data


def test_ir_to_json_chunk_types():
    """Test that chunks are properly typed as text."""
    x = "value"
    p = t_prompts.prompt(t"Prefix {x:x} suffix")
    ir = p.render()

    data = ir.toJSON()

    # All chunks should be text type (no images in this test)
    for chunk in data["chunks"]:
        assert chunk["type"] == "text"
        assert "text" in chunk
        assert "id" in chunk
        assert "chunk_index" in chunk


def test_ir_to_json_empty_prompt():
    """Test toJSON() with prompt containing only static text."""
    p = t_prompts.prompt(t"Just static text")
    ir = p.render()

    data = ir.toJSON()

    # Should have one text chunk
    assert len(data["chunks"]) == 1
    assert data["chunks"][0]["text"] == "Just static text"

    # Source map should have one static span
    static_spans = [s for s in data["source_map"] if s["element_type"] == "static"]
    assert len(static_spans) == 1


def test_ir_to_json_paths():
    """Test that paths are correctly converted to lists."""
    inner = "value"
    p_inner = t_prompts.prompt(t"{inner:i}")
    p_outer = t_prompts.prompt(t"{p_inner:nested}")

    ir = p_outer.render()
    data = ir.toJSON()

    # Find a span with non-empty path
    nested_spans = [s for s in data["source_map"] if len(s["path"]) > 0]
    assert len(nested_spans) > 0

    # Check that path is a list
    for span in nested_spans:
        assert isinstance(span["path"], list)
        # Path should contain "nested" for nested element
        if span["element_type"] == "interpolation" and span["key"] == "i":
            assert "nested" in span["path"]


def test_ir_to_json_element_ids():
    """Test that element_id references are valid."""
    x = "X"
    p = t_prompts.prompt(t"{x:x}")
    ir = p.render()

    data = ir.toJSON()

    # Collect all element IDs from source_prompt
    element_ids = set()

    def collect_ids(children):
        for child in children:
            element_ids.add(child["id"])
            if "children" in child:
                if isinstance(child["children"], list):
                    # Could be regular children or list items
                    if child["children"] and isinstance(child["children"][0], dict):
                        if "prompt_id" in child["children"][0]:
                            # List items
                            for item in child["children"]:
                                collect_ids(item["children"])
                        else:
                            # Regular children
                            collect_ids(child["children"])

    collect_ids(data["source_prompt"]["children"])

    # All element_ids in source_map should reference valid elements
    for span in data["source_map"]:
        assert span["element_id"] in element_ids, f"Invalid element_id: {span['element_id']}"


def test_ir_to_json_chunk_id_lookup():
    """Test that chunk_id_to_index provides correct mapping."""
    x = "test"
    p = t_prompts.prompt(t"{x:x}")
    ir = p.render()

    data = ir.toJSON()

    # Every chunk ID should be in the lookup
    for chunk in data["chunks"]:
        assert chunk["id"] in data["chunk_id_to_index"]
        assert data["chunk_id_to_index"][chunk["id"]] == chunk["chunk_index"]


def test_ir_to_json_with_conversion():
    """Test toJSON() preserves conversion in source_prompt."""
    text = "hello"
    p = t_prompts.prompt(t"{text!r:t}")
    ir = p.render()

    data = ir.toJSON()

    # Find interpolation in source_prompt
    source_prompt = data["source_prompt"]
    interps = [c for c in source_prompt["children"] if c.get("type") == "interpolation"]
    assert len(interps) == 1
    assert interps[0]["conversion"] == "r"


def test_ir_to_json_with_render_hints():
    """Test toJSON() preserves render hints in source_prompt."""
    content = "test"
    p = t_prompts.prompt(t"{content:c:xml=data}")
    ir = p.render()

    data = ir.toJSON()

    # Find interpolation in source_prompt
    source_prompt = data["source_prompt"]
    interps = [c for c in source_prompt["children"] if c.get("type") == "interpolation"]
    assert len(interps) == 1
    assert "xml=data" in interps[0]["render_hints"]


def test_ir_to_json_with_image():
    """Test toJSON() with ImageChunk (if PIL available)."""
    try:
        from PIL import Image
    except ImportError:
        # Skip test if PIL not available
        return

    # Create a minimal image
    img = Image.new("RGB", (10, 10), color="red")
    p = t_prompts.prompt(t"Image: {img:img}")

    # Images cannot be rendered to text, so we need to test differently
    # For now, just verify the prompt structure includes the image
    assert "img" in p
    assert isinstance(p["img"], t_prompts.ImageInterpolation)

    # Verify that toJSON() on the prompt includes image data
    prompt_json = p.toJSON()
    image_elems = [c for c in prompt_json["children"] if c.get("type") == "image"]
    assert len(image_elems) == 1
    assert "image_data" in image_elems[0]


def test_ir_to_json_complex_structure():
    """Test toJSON() with a complex prompt structure."""
    val1 = "first"
    val2 = "second"
    inner1 = t_prompts.prompt(t"Value: {val1:v}")
    inner2 = t_prompts.prompt(t"Value: {val2:v}")
    items = [inner1, inner2]
    p = t_prompts.prompt(t"Header\n{items:list}")

    ir = p.render()
    data = ir.toJSON()

    # Verify all top-level keys are present
    assert all(key in data for key in ["ir_id", "source_prompt", "chunks", "chunk_id_to_index", "source_map"])

    # Verify chunks
    assert len(data["chunks"]) == 1
    assert data["chunks"][0]["type"] == "text"

    # Verify source_map has multiple spans
    assert len(data["source_map"]) > 0

    # Verify all spans have valid chunk references
    for span in data["source_map"]:
        chunk_id = span["chunk_id"]
        chunk_index = span["chunk_index"]
        assert data["chunks"][chunk_index]["id"] == chunk_id


def test_ir_to_json_source_location():
    """Test that source location is included when available."""
    x = "X"
    p = t_prompts.prompt(t"{x:x}")
    ir = p.render()

    data = ir.toJSON()

    # Check that source_prompt includes source location (if captured)
    source_prompt = data["source_prompt"]
    for child in source_prompt["children"]:
        if child.get("type") == "interpolation":
            # source_location might be None or a dict depending on capture_source_location
            if child["source_location"] is not None:
                assert "filename" in child["source_location"]
                assert "filepath" in child["source_location"]
                assert "line" in child["source_location"]


def test_ir_to_json_no_source_location():
    """Test toJSON() when source location capture is disabled."""
    x = "X"
    p = t_prompts.prompt(t"{x:x}", capture_source_location=False)
    ir = p.render()

    data = ir.toJSON()

    # All source_location fields should be None
    source_prompt = data["source_prompt"]
    for child in source_prompt["children"]:
        assert child["source_location"] is None
