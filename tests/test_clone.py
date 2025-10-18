"""Tests for StructuredPrompt.clone() functionality."""

from t_prompts import prompt


def test_clone_basic():
    """Test basic cloning of a simple prompt."""
    task = "translate"
    original = prompt(t"Task: {task}")

    cloned = original.clone()

    # Should have different IDs
    assert cloned.id != original.id

    # Should have no parent
    assert cloned.parent is None
    assert original.parent is None

    # Should render the same
    assert str(cloned) == str(original)
    assert str(cloned) == "Task: translate"


def test_clone_can_be_nested_independently():
    """Test that cloned prompts can be nested in different locations."""
    task = "translate"
    template = prompt(t"Task: {task}")

    # Clone twice
    instance1 = template.clone()
    instance2 = template.clone()

    # Should be able to nest both independently
    outer = prompt(t"{instance1:i1}\n{instance2:i2}")

    assert str(outer) == "Task: translate\nTask: translate"


def test_clone_with_nested_prompt():
    """Test cloning a prompt that contains nested prompts."""
    inner = prompt(t"Inner content")
    task = "translate"
    original = prompt(t"Task: {task}\nNested: {inner:i}")

    cloned = original.clone()

    # Should have different IDs
    assert cloned.id != original.id

    # Nested prompts should also be cloned
    cloned_inner = cloned["i"]
    assert cloned_inner.id != inner.id

    # Should render the same
    assert str(cloned) == str(original)
    assert str(cloned) == "Task: translate\nNested: Inner content"


def test_clone_deep_copies_nested_prompts():
    """Test that cloning deeply copies nested prompts."""
    inner = prompt(t"Inner")
    middle = prompt(t"Middle: {inner:i}")
    outer = prompt(t"Outer: {middle:m}")

    cloned_outer = outer.clone()

    # All levels should be cloned with new IDs
    assert cloned_outer.id != outer.id
    assert cloned_outer["m"].id != middle.id
    assert cloned_outer["m"]["i"].id != inner.id

    # Should render the same
    assert str(cloned_outer) == str(outer)
    assert str(cloned_outer) == "Outer: Middle: Inner"


def test_clone_with_list_interpolation():
    """Test cloning a prompt with list interpolation."""
    items = [
        prompt(t"Item 1"),
        prompt(t"Item 2"),
        prompt(t"Item 3"),
    ]
    original = prompt(t"List: {items:items:sep=, }")

    cloned = original.clone()

    # Should have different ID
    assert cloned.id != original.id

    # List items should be cloned
    cloned_items = cloned["items"].items
    for i, cloned_item in enumerate(cloned_items):
        assert cloned_item.id != items[i].id

    # Should render the same
    assert str(cloned) == str(original)
    assert str(cloned) == "List: Item 1, Item 2, Item 3"


def test_clone_preserves_structure():
    """Test that cloning preserves the prompt structure."""
    name = "Alice"
    age = "30"
    original = prompt(t"Name: {name:n}, Age: {age:a}")

    cloned = original.clone()

    # Should have same keys
    assert list(cloned.keys()) == list(original.keys())
    assert set(cloned.keys()) == {"n", "a"}

    # Should have same values
    assert cloned["n"].value == original["n"].value
    assert cloned["a"].value == original["a"].value

    # Should render the same
    assert str(cloned) == str(original)


def test_clone_with_custom_key():
    """Test cloning with a custom key."""
    original = prompt(t"Content")

    cloned = original.clone(key="custom_key")

    assert cloned.key == "custom_key"
    assert original.key is None  # Original unchanged


def test_clone_source_location():
    """Test that clone captures new source location."""
    original = prompt(t"Content")
    cloned = original.clone()  # This line is the clone site

    # Both should have source locations
    assert original.source_location is not None
    assert cloned.source_location is not None

    # Source locations should be different (different line numbers)
    # Original was created at the prompt() call, clone at the clone() call
    if original.source_location and cloned.source_location:
        assert original.source_location.line != cloned.source_location.line


def test_clone_multiple_times():
    """Test that a prompt can be cloned multiple times."""
    template = prompt(t"Template content")

    clones = [template.clone() for _ in range(5)]

    # All should have unique IDs
    ids = [c.id for c in clones]
    assert len(set(ids)) == 5

    # All should render the same
    for c in clones:
        assert str(c) == "Template content"


def test_clone_template_pattern():
    """Test the template/instance pattern enabled by clone()."""
    # Create a template
    def task_template(task_name):
        task = task_name
        return prompt(t"Task: {task}")

    # Create instances
    task1 = task_template("translate").clone()
    task2 = task_template("summarize").clone()
    task3 = task_template("analyze").clone()

    # Compose into a workflow
    workflow = prompt(t"{task1:t1}\n{task2:t2}\n{task3:t3}")

    expected = "Task: translate\nTask: summarize\nTask: analyze"
    assert str(workflow) == expected


def test_clone_preserves_metadata():
    """Test that cloning preserves metadata."""
    original = prompt(t"Content")
    original.metadata["custom_field"] = "value"

    cloned = original.clone()

    # Metadata should be preserved (but it's a new dict)
    assert cloned.metadata["custom_field"] == "value"
    assert cloned.metadata is not original.metadata


def test_clone_with_conversions():
    """Test cloning preserves conversions."""
    name = "Alice"
    original = prompt(t"Name: {name!r:n}")

    cloned = original.clone()

    assert str(cloned) == str(original)
    assert str(cloned) == "Name: 'Alice'"


def test_clone_with_format_spec():
    """Test cloning preserves format specs."""
    value = "test"
    original = prompt(t"Value: {value:v:xml=tag}")

    cloned = original.clone()

    # Should preserve format spec
    assert cloned["v"].format_spec == original["v"].format_spec
    assert cloned["v"].render_hints == original["v"].render_hints


def test_clone_reused_in_demo():
    """Test the clone pattern from the 03_demo scenario."""
    # Simulate the helper function pattern
    def build_section(title):
        t = title
        return prompt(t"## {t:title}")

    # Create a section template
    header = build_section("Overview")

    # Try to use it twice - this would fail without clone
    section1 = header.clone()
    section2 = header.clone()

    doc = prompt(t"{section1:s1}\nContent 1\n\n{section2:s2}\nContent 2")

    assert "## Overview" in str(doc)
    assert str(doc).count("## Overview") == 2


def test_clone_empty_prompt():
    """Test cloning an empty prompt."""
    original = prompt(t"")
    cloned = original.clone()

    assert cloned.id != original.id
    assert str(cloned) == ""


def test_clone_with_allow_duplicate_keys():
    """Test cloning preserves allow_duplicate_keys setting."""
    x = "1"
    y = "2"
    original = prompt(t"{x:x} {y:x}", allow_duplicate_keys=True)

    cloned = original.clone()

    assert cloned._allow_duplicates == True
    assert str(cloned) == str(original)


def test_clone_independence():
    """Test that cloned prompts are truly independent."""
    inner = prompt(t"Inner")
    original = prompt(t"Original: {inner:i}")

    cloned = original.clone()

    # Modify original's nested prompt's metadata
    original["i"].metadata["modified"] = True

    # Cloned version should not be affected
    assert "modified" not in cloned["i"].metadata
