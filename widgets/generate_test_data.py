#!/usr/bin/env env python3
"""
Generate test data JSON files for widget tests.

This script creates JSON files that match the exact structure
that the Python widget renderer would produce.
"""

import json
import sys
from importlib import import_module
from pathlib import Path

# Add parent directory to path to import t_prompts
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from t_prompts import prompt  # noqa: E402


def generate_long_text_test():
    """Generate test data for line wrapping with 240 'a' characters."""
    # Create a prompt with a single static element containing 240 'a' characters
    long_text = "a" * 240

    # Create a prompt using t-string syntax
    p = prompt(t"{long_text}")

    # Get the IR
    ir_obj = p.ir()

    # Compile the IR
    compiled_ir = ir_obj.compile()

    # Get the widget data (JSON) directly
    data = compiled_ir.widget_data()

    return data


def generate_complex_test():
    """Generate test data with intro text and long text (240 'a's)."""
    from t_prompts import dedent

    intro = "This is a comprehensive test"
    long = "a" * 240

    p6 = dedent(t"""

    Introduction: {intro:intro}
    {long}


""")

    # Get the IR
    ir_obj = p6.ir()

    # Compile the IR
    compiled_ir = ir_obj.compile()

    # Get the widget data (JSON) directly
    data = compiled_ir.widget_data()

    return data


def generate_markdown_demo_test():
    """Generate test data using the Markdown preview demo (01_demo)."""
    try:
        demo_module = import_module("t_prompts.widgets.demos.01_demo")
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Failed to import demo module. Ensure extras (especially 'image') are installed."
        ) from exc

    if not hasattr(demo_module, "my_prompt"):
        raise RuntimeError("Demo module does not expose a my_prompt function.")

    demo_prompt = demo_module.my_prompt()
    ir_obj = demo_prompt.ir()
    compiled_ir = ir_obj.compile()
    data = compiled_ir.widget_data()

    return data


def main():
    # Generate test data
    long_text_data = generate_long_text_test()
    complex_data = generate_complex_test()
    demo_markdown_data = None

    # Write to JSON file in test fixtures directory
    fixtures_dir = Path(__file__).parent / "test-fixtures"
    fixtures_dir.mkdir(exist_ok=True)

    output_file = fixtures_dir / "long-text-240.json"
    with open(output_file, "w") as f:
        json.dump(long_text_data, f, indent=2)

    print(f"Generated test fixture: {output_file}")
    print(f"Text length: {len('a' * 240)} characters")
    print(f"Expected line breaks at 90 chars: {240 // 90} breaks ({240 / 90:.2f} lines)")
    print("\nTop-level keys in data:")
    for key in long_text_data.keys():
        print(f"  - {key}")

    # Print some details about the IR
    num_chunks = len(long_text_data["ir"]["chunks"])
    print(f"\nNumber of IR chunks: {num_chunks}")

    # Generate complex test data
    output_file2 = fixtures_dir / "complex-wrap-test.json"
    with open(output_file2, "w") as f:
        json.dump(complex_data, f, indent=2)

    print(f"\n\nGenerated complex test fixture: {output_file2}")
    print(f"Number of IR chunks: {len(complex_data['ir']['chunks'])}")
    for i, chunk in enumerate(complex_data['ir']['chunks']):
        text = chunk['text']
        if len(text) > 50:
            print(f"  Chunk {i}: {len(text)} chars - \"{text[:50]}...\"")
        else:
            print(f"  Chunk {i}: {len(text)} chars - \"{text}\"")

    try:
        demo_markdown_data = generate_markdown_demo_test()
    except RuntimeError as exc:
        print("\n\nFailed to generate markdown demo fixture:", exc)
    else:
        output_file3 = fixtures_dir / "demo-01.json"
        with open(output_file3, "w") as f:
            json.dump(demo_markdown_data, f, indent=2)
        print(f"\n\nGenerated markdown demo fixture: {output_file3}")
        print(f"Number of IR chunks: {len(demo_markdown_data['ir']['chunks'])}")
        chunk_ids = [chunk['id'] for chunk in demo_markdown_data['ir']['chunks']]
        print(f"Chunk IDs: {', '.join(chunk_ids)}")


if __name__ == "__main__":
    main()
