#!/usr/bin/env python3
"""Demo widget showing various structured prompt features.

This demo demonstrates:
- Long lines with wrapping
- Lists with default and custom separators
- Nested prompts
- Images
- Mixed content
"""

from PIL import Image

from t_prompts import dedent, prompt
from t_prompts.widgets import run_preview


def generate_structured_prompt():
    """Generate a sample structured prompt with various features.

    Returns
    -------
    StructuredPrompt
        A comprehensive prompt demonstrating all widget features.
    """
    # Test 1: Long Lines
    long_text = (
        "This is a very long piece of text that should definitely wrap when displayed "
        "in the widget viewer because it exceeds the typical character width. "
        "We want to make sure the wrap indicators work correctly and that the text "
        "remains readable even when it spans multiple lines in the rendered output."
    )

    # Test 2: Lists
    items = [prompt(t"Item {str(i):{i}}") for i in range(5)]

    # Test 3: Nested prompts
    system = prompt(t"{'You are a helpful AI assistant.':sys}")

    # Test 4: Images
    img = Image.new("RGB", (100, 100), color="blue")

    # Test 5: Complex mixed content
    examples = [prompt(t"Example {str(i):{i} 2}: Description of example {str(i):{i} 3}") for i in range(3)]
    img2 = Image.new("RGB", (50, 50), color="red")

    # Combine everything into a comprehensive prompt
    comprehensive_prompt = dedent(
        t"""
        {system:system}

        Task: {long_text:task}

        Here are some items to consider:
        {items:items}

        Examples with custom separator:
        {examples:examples:sep=, }

        Visual elements:
        {img:blue_image}
        {img2:red_image}

        Conclusion: This demonstrates all widget features working together,
        including long text wrapping, lists with different separators, nested
        prompts, and images.
        """
    )

    return comprehensive_prompt


def main():
    """Run the widget preview server for this demo."""
    run_preview(__file__, generate_structured_prompt)


if __name__ == "__main__":
    main()
