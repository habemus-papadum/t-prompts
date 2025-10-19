from t_prompts import dedent
from t_prompts.widgets import run_preview


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
    return table_prompt


if __name__ == "__main__":
    run_preview(__file__, generate_markdown_table_examples)
