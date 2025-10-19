#!/usr/bin/env python3
"""
Generate test data JSON files for widget tests.

This script creates JSON files that match the exact structure
that the Python widget renderer would produce.
"""

import argparse
import json
import sys
from dataclasses import dataclass
from importlib import import_module
from pathlib import Path
from typing import Callable, Dict, Iterable, List

# Add parent directory to path to import t_prompts
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from t_prompts import dedent, prompt  # noqa: E402


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
        raise RuntimeError("Failed to import demo module. Ensure extras (especially 'image') are installed.") from exc

    if not hasattr(demo_module, "my_prompt"):
        raise RuntimeError("Demo module does not expose a my_prompt function.")

    demo_prompt = demo_module.my_prompt()
    ir_obj = demo_prompt.ir()
    compiled_ir = ir_obj.compile()
    data = compiled_ir.widget_data()

    return data


def generate_markdown_table_examples():
    """Generate test data showcasing different table interpolation patterns."""
    summary_cell_value = "Dynamic total"
    sales_row = "| July | 120 | 87 |"
    double_rows = "\n".join(["| Region A | 45 | 18 |", "| Region B | 38 | 22 |"])
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
    parser = argparse.ArgumentParser(description="Generate widget test fixture data.")
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
    print("Available fixtures:")
    for spec in fixtures:
        print(f"  - {spec.name:18} {spec.description}")


def resolve_selection(requested: List[str]) -> List[FixtureSpec]:
    if not requested:
        return list(FIXTURES.values())

    missing = [name for name in requested if name not in FIXTURES]
    if missing:
        options = ", ".join(sorted(FIXTURES))
        missing_list = ", ".join(missing)
        raise SystemExit(f"Unknown fixture(s): {missing_list}. Known fixtures: {options}.")

    return [FIXTURES[name] for name in requested]


def write_fixture(spec: FixtureSpec, output_dir: Path, overwrite: bool) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / spec.filename

    if target.exists() and not overwrite:
        print(f"Skipping {spec.name}: {target} already exists (use --overwrite to regenerate).")
        return target

    try:
        data = spec.generator()
    except RuntimeError as exc:
        print(f"Failed to generate fixture '{spec.name}': {exc}")
        return target

    with target.open("w") as handle:
        json.dump(data, handle, indent=2)

    chunk_count = len(data.get("ir", {}).get("chunks", []))
    print(f"Wrote {spec.name} → {target} ({chunk_count} chunks)")
    return target


def main(argv: Iterable[str] = None) -> int:
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
