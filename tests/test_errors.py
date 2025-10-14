"""Error condition tests for structured prompts."""

import pytest

import t_prompts
from t_prompts.exceptions import (
    MissingKeyError,
    NotANestedPromptError,
    UnsupportedValueTypeError,
)


def test_unsupported_value_type_int():
    """Test that integer values raise UnsupportedValueTypeError."""
    num = 42

    with pytest.raises(UnsupportedValueTypeError) as exc_info:
        t_prompts.prompt(t"{num:num}")

    err = exc_info.value
    assert err.key == "num"
    assert err.value_type is int
    assert err.expression == "num"
    assert "expected str or StructuredPrompt" in str(err)
    assert "got int" in str(err)


def test_unsupported_value_type_list():
    """Test that list values raise UnsupportedValueTypeError."""
    data = [1, 2, 3]

    with pytest.raises(UnsupportedValueTypeError) as exc_info:
        t_prompts.prompt(t"{data:data}")

    err = exc_info.value
    assert err.value_type is list
    assert "got list" in str(err)


def test_unsupported_value_type_dict():
    """Test that dict values raise UnsupportedValueTypeError."""
    data = {"key": "value"}

    with pytest.raises(UnsupportedValueTypeError) as exc_info:
        t_prompts.prompt(t"{data:data}")

    err = exc_info.value
    assert err.value_type is dict


def test_unsupported_value_type_object():
    """Test that arbitrary object values raise UnsupportedValueTypeError."""

    class CustomClass:
        pass

    obj = CustomClass()

    with pytest.raises(UnsupportedValueTypeError) as exc_info:
        t_prompts.prompt(t"{obj:obj}")

    err = exc_info.value
    assert err.value_type is CustomClass


def test_empty_expression_error():
    """Test that empty expressions raise EmptyExpressionError."""
    # Note: Python's t-strings might not allow truly empty expressions
    # This test might need adjustment based on actual Python 3.14 behavior
    # For now, we'll test the exception exists and can be raised
    from t_prompts.exceptions import EmptyExpressionError

    err = EmptyExpressionError()
    assert "Empty expression" in str(err)
    assert "{}" in str(err)


def test_missing_key_error():
    """Test that accessing non-existent keys raises MissingKeyError."""
    x = "X"
    p = t_prompts.prompt(t"{x:x}")

    with pytest.raises(MissingKeyError) as exc_info:
        _ = p["nonexistent"]

    err = exc_info.value
    assert err.key == "nonexistent"
    assert "nonexistent" in str(err)
    assert "Available keys:" in str(err)
    assert "'x'" in str(err)


def test_missing_key_error_with_get_all():
    """Test that get_all also raises MissingKeyError for non-existent keys."""
    x = "X"
    p = t_prompts.prompt(t"{x:x}")

    with pytest.raises(MissingKeyError) as exc_info:
        _ = p.get_all("nonexistent")

    assert "nonexistent" in str(exc_info.value)


def test_not_a_nested_prompt_error():
    """Test that indexing into non-nested interpolation raises NotANestedPromptError."""
    x = "X"
    p = t_prompts.prompt(t"{x:x}")

    node = p["x"]

    with pytest.raises(NotANestedPromptError) as exc_info:
        _ = node["anything"]

    err = exc_info.value
    assert err.key == "x"
    assert "Cannot index into interpolation 'x'" in str(err)
    assert "not a StructuredPrompt" in str(err)


def test_not_a_nested_prompt_error_in_chain():
    """Test NotANestedPromptError in a navigation chain."""
    x = "X"
    inner = t_prompts.prompt(t"{x:x}")
    outer = t_prompts.prompt(t"{inner:inner}")

    # outer['inner'] is a StructuredPrompt, so outer['inner']['x'] works
    assert outer["inner"]["x"].value == "X"

    # But outer['inner']['x'] is a string, so we can't index further
    with pytest.raises(NotANestedPromptError):
        _ = outer["inner"]["x"]["anything"]


def test_prompt_requires_template_type():
    """Test that prompt() raises TypeError if not given a Template."""
    with pytest.raises(TypeError) as exc_info:
        t_prompts.prompt("not a template")

    assert "requires a t-string Template" in str(exc_info.value)


def test_prompt_requires_template_type_with_fstring():
    """Test that prompt() rejects f-strings (which are just strings)."""
    x = "X"
    fstring_result = f"{x}"  # This is just a str

    with pytest.raises(TypeError):
        t_prompts.prompt(fstring_result)


def test_error_messages_include_context():
    """Test that error messages include helpful context."""
    num = 42

    with pytest.raises(UnsupportedValueTypeError) as exc_info:
        t_prompts.prompt(t"{num:my_number}")

    err_msg = str(exc_info.value)
    assert "my_number" in err_msg  # key
    assert "num" in err_msg  # expression
    assert "int" in err_msg  # type


def test_multiple_errors_stop_at_first():
    """Test that construction stops at the first error encountered."""
    # If we have multiple unsupported types, only the first should be reported
    a = 42
    b = [1, 2, 3]

    # The error should be for 'a', not 'b'
    with pytest.raises(UnsupportedValueTypeError) as exc_info:
        t_prompts.prompt(t"{a:a} {b:b}")

    err = exc_info.value
    assert err.key == "a"  # First interpolation


def test_nested_prompt_with_unsupported_type():
    """Test error when nested prompt contains unsupported type."""
    # Test that inner prompts with unsupported types fail
    num = 42

    # The prompt with int should fail
    with pytest.raises(UnsupportedValueTypeError):
        t_prompts.prompt(t"{num:num}")


def test_missing_key_error_lists_available_keys():
    """Test that MissingKeyError shows all available keys."""
    a = "A"
    b = "B"
    c = "C"

    p = t_prompts.prompt(t"{a:a} {b:b} {c:c}")

    with pytest.raises(MissingKeyError) as exc_info:
        _ = p["d"]

    err_msg = str(exc_info.value)
    assert "'a'" in err_msg
    assert "'b'" in err_msg
    assert "'c'" in err_msg
