#!/usr/bin/env python3
"""
Generate test data JSON files for widget tests.

This script creates JSON files that match the exact structure
that the Python widget renderer would produce. These fixtures are used
by TypeScript tests to verify widget rendering behavior.

Usage:
    # Generate all fixtures
    python generate_test_data.py

    # Generate specific fixtures
    python generate_test_data.py long-text-240 demo-01

    # List available fixtures
    python generate_test_data.py --list

    # Force overwrite existing files
    python generate_test_data.py --overwrite
"""

import argparse
import json
import sys
from dataclasses import dataclass
from importlib import import_module
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List

# Add parent directory to path to import t_prompts
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from t_prompts import dedent, prompt  # noqa: E402

# Constants for test data generation
LONG_TEXT_LENGTH = 240
"""Length of repeated characters for line wrapping tests."""

INTRO_TEXT = "This is a comprehensive test"
"""Standard intro text for complex test scenarios."""


def generate_long_text_test() -> Dict[str, Any]:
    """
    Generate test data for line wrapping with 240 'a' characters.

    This fixture is used to test line wrapping behavior at the configured
    wrap width (typically 90 characters). With 240 characters, we expect:
    - 3 lines: 90 + 90 + 60 characters
    - 2 line breaks
    - 2 continuation markers

    Returns:
        Widget data dictionary containing IR, compiled IR, and config.
    """
    # Create a prompt with a single static element containing repeated 'a' chars
    long_text = "a" * LONG_TEXT_LENGTH

    # Create a prompt using t-string syntax
    simple_prompt = prompt(t"{long_text}")

    # Get the IR and compile it
    ir_obj = simple_prompt.ir()
    compiled_ir = ir_obj.compile()

    # Return the widget data (JSON-serializable structure)
    return compiled_ir.widget_data()


def generate_complex_test() -> Dict[str, Any]:
    """
    Generate test data with intro text and long text (240 'a's).

    This fixture tests wrapping behavior with mixed content:
    - Short intro text that should NOT wrap
    - Long repeated text that SHOULD wrap into multiple lines

    The fixture validates that wrapping heuristics correctly identify
    which chunks need wrapping vs which should remain on a single line.

    Returns:
        Widget data dictionary containing IR, compiled IR, and config.
    """
    intro = INTRO_TEXT
    long_text = "a" * LONG_TEXT_LENGTH

    # Create a complex prompt with multiple text chunks
    complex_prompt = dedent(t"""

    Introduction: {intro:intro}
    {long_text}


""")

    # Get the IR and compile it
    ir_obj = complex_prompt.ir()
    compiled_ir = ir_obj.compile()

    # Return the widget data
    return compiled_ir.widget_data()


def generate_markdown_demo_test() -> Dict[str, Any]:
    """
    Generate test data using the Markdown preview demo (01_demo).

    This fixture uses the comprehensive demo from the demos package,
    which includes various Markdown features like headings, code blocks,
    math expressions, and interpolations.

    Requires the 'image' extra to be installed for full functionality.

    Returns:
        Widget data dictionary from the demo prompt.

    Raises:
        RuntimeError: If the demo module cannot be imported or is malformed.
    """
    try:
        demo_module = import_module("t_prompts.widgets.demos.01_demo")
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Failed to import demo module. Ensure extras (especially 'image') are installed."
        ) from exc

    if not hasattr(demo_module, "my_prompt"):
        raise RuntimeError("Demo module does not expose a 'my_prompt' function.")

    demo_prompt = demo_module.my_prompt()
    ir_obj = demo_prompt.ir()
    compiled_ir = ir_obj.compile()

    return compiled_ir.widget_data()


def generate_markdown_table_examples() -> Dict[str, Any]:
    """
    Generate test data showcasing different table interpolation patterns.

    This fixture covers several table interpolation scenarios:
    1. Single cell interpolation within a mostly static table
    2. Full row interpolation (single row)
    3. Multi-row interpolation (multiple rows at once)
    4. Inline summary cell with string conversion

    These patterns are important for testing how the widget handles
    collapsing/expanding different granularities of table content.

    Returns:
        Widget data dictionary containing various table examples.
    """
    # Sample data for table interpolations
    summary_cell_value = "Dynamic total"
    sales_row = "| July | 120 | 87 |"
    double_rows = "\n".join([
        "| Region A | 45 | 18 |",
        "| Region B | 38 | 22 |"
    ])
    cell_value = "42"

    table_prompt = dedent(t"""
    # Table Fixtures

    ## Mostly static table with dynamic cell

    | Metric | Value |
    | ------ | ----- |
    | Static | 100 |
    | Dynamic | {cell_value} |

    ## Table with interpolated row

    | Month | New Users | Renewals |
    | ----- | --------- | -------- |
    | June | 98 | 73 |
    {sales_row}

    ## Table with multi-row interpolation

    | Segment | Trials | Conversions |
    | ------- | ------ | ----------- |
    | Organic | 52 | 21 |
    {double_rows}
    | Paid | 61 | 28 |

    ## Table with inline summary cell

    | Summary | Value |
    | ------- | ----- |
    | Static Total | 187 |
    | Inline Total | {summary_cell_value!s} |
    """)

    ir_obj = table_prompt.ir()
    compiled_ir = ir_obj.compile()
    return compiled_ir.widget_data()


@dataclass(frozen=True)
class FixtureSpec:
    name: str
    filename: str
    generator: Callable[[], Dict[str, object]]
    description: str


FIXTURES: Dict[str, FixtureSpec] = {
    "long-text-240": FixtureSpec(
        name="long-text-240",
        filename="long-text-240.json",
        generator=generate_long_text_test,
        description="Single static chunk with 240 characters for wrapping tests.",
    ),
    "complex-wrap-test": FixtureSpec(
        name="complex-wrap-test",
        filename="complex-wrap-test.json",
        generator=generate_complex_test,
        description="Intro text followed by a long chunk to exercise wrapping heuristics.",
    ),
    "demo-01": FixtureSpec(
        name="demo-01",
        filename="demo-01.json",
        generator=generate_markdown_demo_test,
        description="Widget data produced by the Markdown demo prompt (requires extras).",
    ),
    "tables": FixtureSpec(
        name="tables",
        filename="tables.json",
        generator=generate_markdown_table_examples,
        description="Multiple markdown tables covering partial cell, single-row, and multi-row interpolations.",
    ),
}


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    """
    Parse command-line arguments for the test data generator.

    Args:
        argv: Command-line arguments (excluding program name).

    Returns:
        Parsed arguments namespace.
    """
    parser = argparse.ArgumentParser(
        description="Generate widget test fixture data.",
        epilog="These fixtures are used by TypeScript tests in src/components/",
    )
    parser.add_argument(
        "fixtures",
        nargs="*",
        metavar="FIXTURE",
        help="Fixture names to generate (default: all). Use --list to see options.",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available fixtures and exit.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).parent / "test-fixtures",
        help="Directory for generated fixtures (default: widgets/test-fixtures).",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing files instead of skipping them.",
    )
    return parser.parse_args(list(argv))


def list_fixtures(fixtures: Iterable[FixtureSpec]) -> None:
    """
    Display available test fixtures to stdout.

    Args:
        fixtures: Iterable of fixture specifications to list.
    """
    print("Available fixtures:")
    for spec in fixtures:
        print(f"  - {spec.name:20} {spec.description}")


def resolve_selection(requested: List[str]) -> List[FixtureSpec]:
    """
    Resolve requested fixture names to fixture specifications.

    Args:
        requested: List of fixture names requested by the user.
                  Empty list means all fixtures.

    Returns:
        List of FixtureSpec objects to generate.

    Raises:
        SystemExit: If any requested fixture name is not recognized.
    """
    if not requested:
        return list(FIXTURES.values())

    missing = [name for name in requested if name not in FIXTURES]
    if missing:
        options = ", ".join(sorted(FIXTURES))
        missing_list = ", ".join(missing)
        raise SystemExit(
            f"Unknown fixture(s): {missing_list}. Known fixtures: {options}."
        )

    return [FIXTURES[name] for name in requested]


def write_fixture(spec: FixtureSpec, output_dir: Path, overwrite: bool) -> Path:
    """
    Generate and write a single test fixture to disk.

    Args:
        spec: Fixture specification defining what to generate.
        output_dir: Directory where fixture JSON file should be written.
        overwrite: If True, overwrite existing files; if False, skip them.

    Returns:
        Path to the written (or existing) fixture file.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / spec.filename

    if target.exists() and not overwrite:
        print(
            f"Skipping {spec.name}: {target} already exists "
            "(use --overwrite to regenerate)."
        )
        return target

    try:
        data = spec.generator()
    except RuntimeError as exc:
        print(f"Failed to generate fixture '{spec.name}': {exc}")
        return target

    with target.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)
        # Add trailing newline for better git diffs
        handle.write("\n")

    chunk_count = len(data.get("ir", {}).get("chunks", []))
    print(f"Wrote {spec.name} → {target} ({chunk_count} chunks)")
    return target


def main(argv: Iterable[str] | None = None) -> int:
    """
    Main entry point for the test fixture generator.

    Args:
        argv: Command-line arguments (excluding program name).
              If None, uses sys.argv[1:].

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    args = parse_args(argv or sys.argv[1:])

    if args.list:
        list_fixtures(FIXTURES.values())
        return 0

    try:
        selection = resolve_selection(args.fixtures)
    except SystemExit as exc:
        print(exc)
        return 1

    for spec in selection:
        write_fixture(spec, args.output_dir, args.overwrite)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
