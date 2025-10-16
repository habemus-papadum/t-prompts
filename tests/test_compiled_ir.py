"""Tests for CompiledIR functionality."""


import t_prompts


def test_compiled_ir_basic():
    """Test basic CompiledIR creation and access."""
    value = "test"
    p = t_prompts.prompt(t"Value: {value:v}")

    ir = p.ir()
    compiled = ir.compile()

    # Check that we can access the original IR
    assert compiled.ir is ir
    assert compiled.ir.id == ir.id


def test_compiled_ir_get_chunks_for_subtree_simple():
    """Test get_chunks_for_subtree with a simple prompt."""
    value = "hello"
    p = t_prompts.prompt(t"Start {value:v} end")

    ir = p.ir()
    compiled = ir.compile()

    # Get chunks for the entire prompt
    all_chunks = compiled.get_chunks_for_subtree(p.id)
    assert len(all_chunks) == 3
    assert all_chunks[0].text == "Start "
    assert all_chunks[1].text == "hello"
    assert all_chunks[2].text == " end"

    # Get chunks for just the interpolation element
    interp_element = p.children[1]  # The middle element is the interpolation
    interp_chunks = compiled.get_chunks_for_subtree(interp_element.id)
    assert len(interp_chunks) == 1
    assert interp_chunks[0].text == "hello"

    # Get chunks for a static element
    static_element = p.children[0]  # First static "Start "
    static_chunks = compiled.get_chunks_for_subtree(static_element.id)
    assert len(static_chunks) == 1
    assert static_chunks[0].text == "Start "


def test_compiled_ir_get_chunks_for_subtree_nested():
    """Test get_chunks_for_subtree with nested prompts."""
    inner = "world"
    p_inner = t_prompts.prompt(t"inner {inner:i}")
    p_outer = t_prompts.prompt(t"Hello {p_inner:p}!")

    ir = p_outer.ir()
    compiled = ir.compile()

    # Get chunks for entire outer prompt
    all_chunks = compiled.get_chunks_for_subtree(p_outer.id)
    assert len(all_chunks) == 4
    assert all_chunks[0].text == "Hello "
    assert all_chunks[1].text == "inner "
    assert all_chunks[2].text == "world"
    assert all_chunks[3].text == "!"

    # Get chunks for the nested prompt element
    nested_element = p_outer["p"]
    nested_chunks = compiled.get_chunks_for_subtree(nested_element.id)
    assert len(nested_chunks) == 2  # "inner " and "world"
    assert nested_chunks[0].text == "inner "
    assert nested_chunks[1].text == "world"

    # Get chunks for the inner prompt via its parent element (the wrapper)
    # StructuredPrompts aren't directly in subtree_map, but their parent elements are
    # With new structure: parent[key] gets the wrapper element
    inner_chunks = compiled.get_chunks_for_subtree(p_inner.parent[p_inner.key].id)
    assert len(inner_chunks) == 2
    assert inner_chunks[0].text == "inner "
    assert inner_chunks[1].text == "world"

    # Get chunks for just the inner interpolation
    inner_interp = p_inner["i"]
    inner_interp_chunks = compiled.get_chunks_for_subtree(inner_interp.id)
    assert len(inner_interp_chunks) == 1
    assert inner_interp_chunks[0].text == "world"


def test_compiled_ir_get_chunks_for_subtree_list():
    """Test get_chunks_for_subtree with list interpolations."""
    item1 = t_prompts.prompt(t"Item 1")
    item2 = t_prompts.prompt(t"Item 2")
    items = [item1, item2]
    p = t_prompts.prompt(t"List: {items:items}")

    ir = p.ir()
    compiled = ir.compile()

    # Get chunks for entire prompt - check actual content
    all_chunks = compiled.get_chunks_for_subtree(p.id)
    texts = [chunk.text for chunk in all_chunks]
    assert "List: " in texts
    assert "Item 1" in texts
    assert "\n" in texts  # Default separator
    assert "Item 2" in texts

    # Get chunks for the list interpolation (includes all items + separator)
    list_element = p["items"]
    list_chunks = compiled.get_chunks_for_subtree(list_element.id)
    list_texts = [chunk.text for chunk in list_chunks]
    assert "Item 1" in list_texts
    assert "\n" in list_texts
    assert "Item 2" in list_texts

    # Get chunks for first item prompt (stored directly, not wrapped)
    item1_wrapper = list_element.item_elements[0]
    item1_chunks = compiled.get_chunks_for_subtree(item1_wrapper.id)
    assert len(item1_chunks) == 1
    assert item1_chunks[0].text == "Item 1"


def test_compiled_ir_get_chunks_for_subtree_deeply_nested():
    """Test get_chunks_for_subtree with deeply nested prompts."""
    a = "A"
    p1 = t_prompts.prompt(t"{a:a}")
    p2 = t_prompts.prompt(t"[{p1:p1}]")
    p3 = t_prompts.prompt(t"<{p2:p2}>")

    ir = p3.ir()
    compiled = ir.compile()

    # Get chunks for entire p3 - check content
    all_chunks = compiled.get_chunks_for_subtree(p3.id)
    texts = [chunk.text for chunk in all_chunks]
    assert "<" in texts
    assert "[" in texts
    assert "A" in texts
    assert "]" in texts
    assert ">" in texts

    # Get chunks for p2 via its parent element
    p2_chunks = compiled.get_chunks_for_subtree(p2.parent[p2.key].id)
    p2_texts = [chunk.text for chunk in p2_chunks]
    assert "[" in p2_texts
    assert "A" in p2_texts
    assert "]" in p2_texts

    # Get chunks for p1 via its parent element
    p1_chunks = compiled.get_chunks_for_subtree(p1.parent[p1.key].id)
    assert len(p1_chunks) == 1
    assert p1_chunks[0].text == "A"


def test_compiled_ir_get_chunks_for_subtree_not_found():
    """Test get_chunks_for_subtree with non-existent element_id."""
    p = t_prompts.prompt(t"Hello")
    ir = p.ir()
    compiled = ir.compile()

    # Non-existent ID should return empty list
    chunks = compiled.get_chunks_for_subtree("non-existent-id")
    assert chunks == []


def test_compiled_ir_get_chunks_for_subtree_with_render_hints():
    """Test get_chunks_for_subtree with render hints (xml, header)."""
    value = "test"
    p = t_prompts.prompt(t"{value:v:xml=wrapper}")

    ir = p.ir()
    compiled = ir.compile()

    # Get chunks for the interpolation element (includes wrapper)
    interp_element = p["v"]
    chunks = compiled.get_chunks_for_subtree(interp_element.id)
    assert len(chunks) == 3
    assert chunks[0].text == "<wrapper>\n"
    assert chunks[1].text == "test"
    assert chunks[2].text == "\n</wrapper>"

    # All chunks should point back to the interpolation element
    assert all(chunk.element_id == interp_element.id for chunk in chunks)


def test_compiled_ir_to_json():
    """Test CompiledIR.toJSON method."""
    value = "test"
    p = t_prompts.prompt(t"Value: {value:v}")

    ir = p.ir()
    compiled = ir.compile()

    json_data = compiled.toJSON()

    # Check structure
    assert "ir_id" in json_data
    assert "subtree_map" in json_data
    assert "num_elements" in json_data

    # Check ir_id references the original IR
    assert json_data["ir_id"] == ir.id

    # Check subtree_map contains element IDs
    assert isinstance(json_data["subtree_map"], dict)
    assert p.id in json_data["subtree_map"]

    # Check that subtree_map values are lists of chunk IDs (strings), not indices
    for element_id, chunk_ids in json_data["subtree_map"].items():
        assert isinstance(chunk_ids, list)
        for chunk_id in chunk_ids:
            assert isinstance(chunk_id, str)

    # Check num_elements
    assert json_data["num_elements"] > 0


def test_compiled_ir_to_json_nested():
    """Test CompiledIR.toJSON with nested prompts."""
    inner = "world"
    p_inner = t_prompts.prompt(t"{inner:i}")
    p_outer = t_prompts.prompt(t"Hello {p_inner:p}")

    ir = p_outer.ir()
    compiled = ir.compile()

    json_data = compiled.toJSON()

    # Should have entries for both prompts and their elements
    subtree_map = json_data["subtree_map"]

    # Outer prompt should have all chunks
    assert p_outer.id in subtree_map
    outer_chunk_ids = subtree_map[p_outer.id]
    assert len(outer_chunk_ids) == 2  # "Hello " and "world"

    # Inner prompt's wrapper element should have its chunks
    # StructuredPrompts aren't directly in subtree_map, use parent[key]
    assert p_inner.parent[p_inner.key].id in subtree_map
    inner_chunk_ids = subtree_map[p_inner.parent[p_inner.key].id]
    assert len(inner_chunk_ids) == 1  # "world"

    # Verify chunk IDs are actual chunk IDs from the IR
    all_chunk_ids = {chunk.id for chunk in ir.chunks}
    for chunk_ids in subtree_map.values():
        for chunk_id in chunk_ids:
            assert chunk_id in all_chunk_ids


def test_compiled_ir_to_json_list():
    """Test CompiledIR.toJSON with list interpolations."""
    item1 = t_prompts.prompt(t"First")
    item2 = t_prompts.prompt(t"Second")
    items = [item1, item2]
    p = t_prompts.prompt(t"{items:items}")

    ir = p.ir()
    compiled = ir.compile()

    json_data = compiled.toJSON()
    subtree_map = json_data["subtree_map"]

    # List interpolation should include all item chunks + separator
    list_element = p["items"]
    assert list_element.id in subtree_map
    list_chunk_ids = subtree_map[list_element.id]
    assert len(list_chunk_ids) == 3  # "First", "\n", "Second"

    # Each item's wrapper element should have its own entry
    # Items are wrapped for hierarchical collapse
    item1_wrapper = list_element.item_elements[0]
    item2_wrapper = list_element.item_elements[1]
    assert item1_wrapper.id in subtree_map
    assert item2_wrapper.id in subtree_map


def test_compiled_ir_repr():
    """Test CompiledIR.__repr__."""
    value = "test"
    p = t_prompts.prompt(t"{value:v}")

    ir = p.ir()
    compiled = ir.compile()

    repr_str = repr(compiled)
    assert "CompiledIR" in repr_str
    assert "chunks=" in repr_str
    assert "elements=" in repr_str


def test_compiled_ir_empty_prompt():
    """Test CompiledIR with an empty prompt."""
    p = t_prompts.prompt(t"")

    ir = p.ir()
    compiled = ir.compile()

    # Should still work, just with no chunks
    all_chunks = compiled.get_chunks_for_subtree(p.id)
    assert len(all_chunks) == 0

    json_data = compiled.toJSON()
    assert json_data["ir_id"] == ir.id
    assert isinstance(json_data["subtree_map"], dict)


def test_compiled_ir_multiple_interpolations():
    """Test CompiledIR with multiple interpolations."""
    name = "Alice"
    age = "30"
    city = "NYC"
    p = t_prompts.prompt(t"Name: {name:n}, Age: {age:a}, City: {city:c}")

    ir = p.ir()
    compiled = ir.compile()

    # Get chunks for each interpolation
    name_chunks = compiled.get_chunks_for_subtree(p["n"].id)
    assert len(name_chunks) == 1
    assert name_chunks[0].text == "Alice"

    age_chunks = compiled.get_chunks_for_subtree(p["a"].id)
    assert len(age_chunks) == 1
    assert age_chunks[0].text == "30"

    city_chunks = compiled.get_chunks_for_subtree(p["c"].id)
    assert len(city_chunks) == 1
    assert city_chunks[0].text == "NYC"

    # Get all chunks
    all_chunks = compiled.get_chunks_for_subtree(p.id)
    assert len(all_chunks) == 6  # 3 statics + 3 interpolations


def test_compiled_ir_with_list_separator():
    """Test CompiledIR with custom list separator."""
    item1 = t_prompts.prompt(t"A")
    item2 = t_prompts.prompt(t"B")
    items = [item1, item2]
    p = t_prompts.prompt(t"{items:items:sep=, }")

    ir = p.ir()
    compiled = ir.compile()

    # Get chunks for list - check content
    list_chunks = compiled.get_chunks_for_subtree(p["items"].id)
    texts = [chunk.text for chunk in list_chunks]
    assert "A" in texts
    assert ", " in texts  # Custom separator
    assert "B" in texts

    # Find the separator chunk and verify it points to the list element
    separator_chunks = [chunk for chunk in list_chunks if chunk.text == ", "]
    assert len(separator_chunks) == 1
    assert separator_chunks[0].element_id == p["items"].id
