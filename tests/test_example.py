"""Example tests for structured-prompts."""

import structured_prompts


def test_version():
    """Test that the package has a version."""
    assert hasattr(structured_prompts, "__version__")
    assert isinstance(structured_prompts.__version__, str)
    assert len(structured_prompts.__version__) > 0


def test_import():
    """Test that the package can be imported."""
    assert structured_prompts is not None
