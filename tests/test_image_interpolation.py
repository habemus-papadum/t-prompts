"""Tests for image interpolation support."""

import pytest

# Check if PIL is available
try:
    from PIL import Image

    HAS_PIL = True
except ImportError:
    HAS_PIL = False

from t_prompts import ImageInterpolation, prompt

# Skip all tests in this module if PIL is not available
pytestmark = pytest.mark.skipif(not HAS_PIL, reason="Pillow not installed")


def create_checkerboard(size=64, square_size=8):
    """Create a simple checkerboard pattern image for testing."""
    img = Image.new("RGB", (size, size))
    pixels = img.load()

    for i in range(size):
        for j in range(size):
            # Determine if this square should be black or white
            square_i = i // square_size
            square_j = j // square_size
            is_black = (square_i + square_j) % 2 == 0
            color = (0, 0, 0) if is_black else (255, 255, 255)
            pixels[i, j] = color

    return img


def test_image_interpolation_basic():
    """Test basic image interpolation."""
    img = create_checkerboard()
    p = prompt(t"Image: {img:my_image}")

    assert len(p) == 1
    assert "my_image" in p

    node = p["my_image"]
    assert isinstance(node, ImageInterpolation)
    assert node.value is img
    assert node.key == "my_image"
    assert node.expression == "img"


def test_image_interpolation_with_text():
    """Test image interpolation mixed with text interpolations."""
    img = create_checkerboard()
    description = "A checkerboard pattern"

    p = prompt(t"Description: {description:desc}\nImage: {img:img}")

    assert len(p) == 2
    assert "desc" in p
    assert "img" in p

    # Text interpolation
    desc_node = p["desc"]
    assert desc_node.value == description

    # Image interpolation
    img_node = p["img"]
    assert isinstance(img_node, ImageInterpolation)
    assert img_node.value is img


def test_image_renders_with_placeholder():
    """Test that rendering a prompt with images includes placeholder text."""
    img = create_checkerboard()
    p = prompt(t"Image: {img:my_image}")

    # Should render with placeholder
    result = str(p)
    assert "Image:" in result
    assert "[Image:" in result  # Placeholder starts with [Image:
    assert "64x64" in result  # Image dimensions
    assert "RGB" in result  # Image mode


def test_image_interpolation_metadata():
    """Test that image interpolations preserve full metadata."""
    img = create_checkerboard()
    p = prompt(t"Image: {img:my_image:hint1:hint2}")

    node = p["my_image"]
    assert isinstance(node, ImageInterpolation)
    assert node.expression == "img"
    assert node.key == "my_image"
    assert node.format_spec == "my_image:hint1:hint2"
    assert node.render_hints == "hint1:hint2"
    assert node.conversion is None
    assert node.parent is p


def test_image_interpolation_with_conversion():
    """Test that image interpolations can have conversion flags."""
    img = create_checkerboard()
    p = prompt(t"Image: {img!r:my_image}")

    node = p["my_image"]
    assert isinstance(node, ImageInterpolation)
    assert node.conversion == "r"
    # Renders with placeholder (conversion doesn't affect images)
    result = str(p)
    assert "[Image:" in result


def test_image_interpolation_no_format_spec():
    """Test image interpolation without format spec uses expression as key."""
    img = create_checkerboard()
    p = prompt(t"Image: {img}")

    assert "img" in p
    node = p["img"]
    assert isinstance(node, ImageInterpolation)
    assert node.key == "img"


def test_multiple_images():
    """Test prompt with multiple image interpolations."""
    img1 = create_checkerboard(size=32)
    img2 = create_checkerboard(size=64)

    p = prompt(t"First: {img1:img1}\nSecond: {img2:img2}")

    assert len(p) == 2
    assert isinstance(p["img1"], ImageInterpolation)
    assert isinstance(p["img2"], ImageInterpolation)
    assert p["img1"].value is img1
    assert p["img2"].value is img2

    # Both images render with placeholders
    result = str(p)
    assert "32x32" in result  # First image dimensions
    assert "64x64" in result  # Second image dimensions
    assert result.count("[Image:") == 2  # Two placeholders


def test_image_interpolation_index():
    """Test that image interpolations have correct index in element sequence."""
    img = create_checkerboard()
    text = "Some text"

    p = prompt(t"{text:t} and {img:i}")

    text_node = p["t"]
    img_node = p["i"]

    # First static has index 0, text interpolation has index 1,
    # second static has index 2, image interpolation has index 3
    assert text_node.index == 1
    assert img_node.index == 3


def test_image_in_elements_property():
    """Test that image interpolations appear in elements property."""
    img = create_checkerboard()
    p = prompt(t"Image: {img:my_image}")

    elements = p.children
    # Should have 2 statics and 1 image interpolation
    assert len(elements) == 3

    # Find the image interpolation
    image_elem = None
    for elem in elements:
        if isinstance(elem, ImageInterpolation):
            image_elem = elem
            break

    assert image_elem is not None
    assert image_elem.value is img


def test_image_interpolations_property():
    """Test that image interpolations appear in interpolations property."""
    img = create_checkerboard()
    text = "Some text"

    p = prompt(t"{text:t} {img:i}")

    interps = p.interpolations
    assert len(interps) == 2

    # Check that ImageInterpolation is in the tuple
    img_interp = None
    for interp in interps:
        if isinstance(interp, ImageInterpolation):
            img_interp = interp
            break

    assert img_interp is not None
    assert img_interp.key == "i"


def test_image_access_via_getitem():
    """Test accessing image interpolation via __getitem__."""
    img = create_checkerboard()
    p = prompt(t"Image: {img:my_image}")

    # Access via __getitem__
    node = p["my_image"]
    assert isinstance(node, ImageInterpolation)

    # Value is the actual image
    retrieved_img = node.value
    assert retrieved_img is img
    assert retrieved_img.size == (64, 64)


def test_image_repr():
    """Test that ImageInterpolation has a useful repr."""
    img = create_checkerboard()
    p = prompt(t"Image: {img:my_image}")

    node = p["my_image"]
    repr_str = repr(node)

    assert "ImageInterpolation" in repr_str
    assert "my_image" in repr_str
    assert "img" in repr_str  # expression
    assert "PIL.Image" in repr_str or "<PIL.Image>" in repr_str


def test_text_only_prompt_still_renders():
    """Test that prompts without images still render normally."""
    text1 = "Hello"
    text2 = "World"

    p = prompt(t"{text1:t1} {text2:t2}")

    # Should render fine without images
    rendered = str(p)
    assert rendered == "Hello World"


def test_image_with_dedent():
    """Test image interpolation works with dedent."""
    img = create_checkerboard()
    description = "A pattern"

    p = prompt(
        t"""
        Description: {description:desc}
        Image: {img:img}
        """,
        dedent=True,
    )

    assert len(p) == 2
    assert isinstance(p["img"], ImageInterpolation)

    # Renders with placeholder in dedented output
    result = str(p)
    assert "[Image:" in result
    assert "64x64" in result
    assert "A pattern" in result  # Text interpolation also works
