"""Tests for Element base class and Static elements."""

import t_prompts


def test_element_base_class_exists():
    """Test that Element base class is accessible."""
    assert hasattr(t_prompts, "Element")
    assert hasattr(t_prompts, "Static")


def test_static_class_attributes():
    """Test Static class has required attributes."""
    value = "test"
    p = t_prompts.prompt(t"prefix {value:v} suffix")

    # Access elements property
    # Pattern: strings = ('prefix ', ' suffix'), interpolations = [value]
    # Elements: static "prefix ", interp v, static " suffix"
    elements = p.children
    assert len(elements) == 3

    # First element should be Static with value "prefix "
    static_elem = elements[0]
    assert isinstance(static_elem, t_prompts.Static)
    assert static_elem.value == "prefix "
    assert static_elem.key == 0  # Position in strings tuple
    assert static_elem.parent is p
    assert static_elem.index == 0


def test_static_is_element():
    """Test that Static extends Element."""
    value = "test"
    p = t_prompts.prompt(t"prefix {value:v}")

    # Elements: static "prefix ", interp v, static ""
    elements = p.children
    static_elem = elements[0]  # First element is the static "prefix "

    assert isinstance(static_elem, t_prompts.Static)
    assert isinstance(static_elem, t_prompts.Element)


def test_interpolation_is_element():
    """Test that TextInterpolation extends Element."""
    value = "test"
    p = t_prompts.prompt(t"{value:v}")

    # Elements: static "", interp v, static ""
    elements = p.children
    interp_elem = elements[1]  # Middle element is the interpolation

    assert isinstance(interp_elem, t_prompts.TextInterpolation)
    assert isinstance(interp_elem, t_prompts.Element)


def test_elements_property_interleaves_correctly():
    """Test that elements property interleaves Static and interpolations."""
    a = "A"
    b = "B"
    p = t_prompts.prompt(t"start {a:a} middle {b:b} end")

    # strings = ("start ", " middle ", " end"), interpolations = [a, b]
    # Elements: static "start ", a, static " middle ", b, static " end"
    elements = p.children
    assert len(elements) == 5

    # Check types
    assert isinstance(elements[0], t_prompts.Static)  # "start "
    assert isinstance(elements[1], t_prompts.TextInterpolation)  # a
    assert isinstance(elements[2], t_prompts.Static)  # " middle "
    assert isinstance(elements[3], t_prompts.TextInterpolation)  # b
    assert isinstance(elements[4], t_prompts.Static)  # " end"

    # Check values
    assert elements[0].value == "start "
    assert elements[1].value == "A"
    assert elements[2].value == " middle "
    assert elements[3].value == "B"
    assert elements[4].value == " end"


def test_static_integer_keys():
    """Test that Static elements use integer keys."""
    value = "test"
    p = t_prompts.prompt(t"prefix {value:v} suffix")

    elements = p.children

    # Check that Static elements have integer keys
    for elem in elements:
        if isinstance(elem, t_prompts.Static):
            assert isinstance(elem.key, int)
        elif isinstance(
            elem,
            (
                t_prompts.TextInterpolation,
                t_prompts.StructuredPrompt,
                t_prompts.ListInterpolation,
                t_prompts.ImageInterpolation,
            ),
        ):
            assert isinstance(elem.key, str)


def test_element_indices():
    """Test that element indices are correctly assigned."""
    a = "A"
    b = "B"
    p = t_prompts.prompt(t"{a:a} {b:b}")

    elements = p.children

    # Should be: "" (0), a (1), " " (2), b (3), "" (4)
    assert elements[0].index == 0
    assert elements[1].index == 1
    assert elements[2].index == 2
    assert elements[3].index == 3
    assert elements[4].index == 4


def test_element_parent_references():
    """Test that all elements have correct parent references."""
    value = "test"
    p = t_prompts.prompt(t"prefix {value:v} suffix")

    elements = p.children

    for elem in elements:
        assert elem.parent is p


def test_elements_with_nested_prompts():
    """Test elements property with nested prompts."""
    inner = "inner"
    p_inner = t_prompts.prompt(t"{inner:i}")
    p_outer = t_prompts.prompt(t"outer {p_inner:p}")

    # Check outer elements
    # strings = ("outer ", ""), interpolations = [p_inner]
    # Elements: static "outer ", p_inner interp, static ""
    outer_elements = p_outer.children
    assert len(outer_elements) == 3

    # The second element (index 1) is the nested prompt (stored directly)
    p_elem = outer_elements[1]
    assert isinstance(p_elem, t_prompts.StructuredPrompt)

    # Check inner elements
    # strings = ("", ""), interpolations = [inner]
    # Elements: static "", inner interp, static ""
    inner_elements = p_inner.children
    assert len(inner_elements) == 3


def test_static_frozen_dataclass():
    """Test that Static is a frozen dataclass."""
    value = "test"
    p = t_prompts.prompt(t"prefix {value:v}")

    elements = p.children
    static_elem = elements[1]

    # Should not be able to modify frozen dataclass
    try:
        static_elem.value = "modified"
        assert False, "Should not be able to modify frozen dataclass"
    except (AttributeError, Exception):
        pass  # Expected


def test_empty_static_elements():
    """Test that empty static strings are included in elements."""
    value = "test"
    p = t_prompts.prompt(t"{value:v}")

    elements = p.children

    # Should be: "" (empty), value interp, "" (empty)
    assert len(elements) == 3
    assert elements[0].value == ""
    assert isinstance(elements[0], t_prompts.Static)
    assert elements[2].value == ""
    assert isinstance(elements[2], t_prompts.Static)


def test_adjacent_interpolations_with_empty_static():
    """Test adjacent interpolations with empty static in between."""
    a = "A"
    b = "B"
    p = t_prompts.prompt(t"{a:a}{b:b}")

    elements = p.children

    # Should be: "" (empty), a, "" (empty), b, "" (empty)
    assert len(elements) == 5
    assert elements[1].key == "a"
    assert elements[3].key == "b"

    # Check that middle static is empty
    assert elements[2].value == ""
    assert isinstance(elements[2], t_prompts.Static)
