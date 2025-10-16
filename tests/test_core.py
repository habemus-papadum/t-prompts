"""Happy path tests for core functionality."""

import t_prompts


def test_single_interpolation_with_format_spec():
    """Test single interpolation with format spec as key."""
    instructions = "Always answer politely."
    p = t_prompts.prompt(t"Obey {instructions:inst}")

    # Test rendering
    assert str(p) == "Obey Always answer politely."

    # Test provenance access
    node = p["inst"]
    assert node.key == "inst"
    assert node.expression == "instructions"
    assert node.value == "Always answer politely."
    assert node.format_spec == "inst"
    assert node.conversion is None
    # Index is now 1 (element 0 is static "Obey ", element 1 is interpolation)
    assert node.index == 1


def test_single_interpolation_without_format_spec():
    """Test that expression becomes the key when no format spec is provided."""
    foo = "bar"
    p = t_prompts.prompt(t"Value: {foo}")

    assert str(p) == "Value: bar"

    node = p["foo"]
    assert node.key == "foo"
    assert node.expression == "foo"
    assert node.value == "bar"
    assert node.format_spec == ""


def test_conversion_s():
    """Test !s conversion is applied correctly."""
    # Note: t-strings evaluate values first, so we need str values
    # The conversion !s is applied during rendering, not evaluation
    text = "hello"
    p = t_prompts.prompt(t"Text: {text!s:data}")

    result = str(p)
    assert result == "Text: hello"

    node = p["data"]
    assert node.conversion == "s"


def test_conversion_r():
    """Test !r conversion is applied correctly."""
    text = "hello"
    p = t_prompts.prompt(t"Text: {text!r:data}")

    result = str(p)
    assert result == "Text: 'hello'"

    node = p["data"]
    assert node.conversion == "r"


def test_conversion_a():
    """Test !a conversion is applied correctly."""
    text = "hello\n"
    p = t_prompts.prompt(t"Text: {text!a:data}")

    result = str(p)
    assert result == "Text: 'hello\\n'"

    node = p["data"]
    assert node.conversion == "a"


def test_nested_prompts_depth_2():
    """Test nesting prompts 2 levels deep."""
    instructions = "Always answer politely."
    foo = "bar"

    p1 = t_prompts.prompt(t"Obey {instructions:inst}")
    p2 = t_prompts.prompt(t"bazz {foo} {p1}")

    # Test rendering
    assert str(p2) == "bazz bar Obey Always answer politely."

    # Test navigation - StructuredPrompt is now stored directly
    assert isinstance(p2["p1"], t_prompts.StructuredPrompt)

    # Navigate into nested prompt
    inst_node = p2["p1"]["inst"]
    assert inst_node.value == "Always answer politely."
    assert inst_node.expression == "instructions"


def test_nested_prompts_depth_3():
    """Test nesting prompts 3 levels deep."""
    a = "A"
    b = "B"
    c = "C"

    p1 = t_prompts.prompt(t"{a:a}")
    p2 = t_prompts.prompt(t"{b:b} {p1:p1}")
    p3 = t_prompts.prompt(t"{c:c} {p2:p2}")

    # Test rendering
    assert str(p3) == "C B A"

    # Test deep navigation
    assert p3["p2"]["p1"]["a"].value == "A"


def test_multiple_interpolations():
    """Test prompt with multiple interpolations."""
    x = "X"
    y = "Y"
    z = "Z"

    p = t_prompts.prompt(t"{x:x} and {y:y} and {z:z}")

    assert str(p) == "X and Y and Z"
    assert p["x"].value == "X"
    assert p["y"].value == "Y"
    assert p["z"].value == "Z"


def test_iteration_order():
    """Test that iteration preserves insertion order."""
    a = "A"
    b = "B"
    c = "C"

    p = t_prompts.prompt(t"{a:a} {b:b} {c:c}")

    keys = list(p)
    assert keys == ["a", "b", "c"]


def test_len():
    """Test that len() returns number of unique keys."""
    a = "A"
    b = "B"

    p = t_prompts.prompt(t"{a:a} {b:b}")

    assert len(p) == 2


def test_mapping_protocol():
    """Test that StructuredPrompt works as a Mapping."""
    x = "X"
    y = "Y"

    p = t_prompts.prompt(t"{x:x} {y:y}")

    # Test __contains__
    assert "x" in p
    assert "y" in p
    assert "z" not in p

    # Test keys(), values(), items()
    assert list(p.keys()) == ["x", "y"]
    assert all(isinstance(v, t_prompts.TextInterpolation) for v in p.values())
    assert all(isinstance(k, str) and isinstance(v, t_prompts.TextInterpolation) for k, v in p.items())


def test_strings_property():
    """Test access to original string segments."""
    x = "X"
    y = "Y"

    p = t_prompts.prompt(t"before {x:x} middle {y:y} after")

    assert p.strings == ("before ", " middle ", " after")


def test_interpolations_property():
    """Test access to all interpolation nodes."""
    x = "X"
    y = "Y"

    p = t_prompts.prompt(t"{x:x} {y:y}")

    interps = p.interpolations
    assert len(interps) == 2
    assert all(isinstance(i, t_prompts.TextInterpolation) for i in interps)
    assert interps[0].key == "x"
    assert interps[1].key == "y"


def test_template_property():
    """Test access to original Template object."""
    x = "X"
    p = t_prompts.prompt(t"{x:x}")

    from string.templatelib import Template

    assert isinstance(p.template, Template)
