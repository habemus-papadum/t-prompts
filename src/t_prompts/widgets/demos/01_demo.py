from PIL import Image

from t_prompts import dedent, prompt
from t_prompts.widgets import run_preview

# Combine everything
intro = "This is a comprehensive test"
examples = [prompt(t"- Example {str(i):{i}}") for i in range(3)]
img2 = Image.new("RGB", (50, 50), color="red")
long = ("a" * 240 )
latex = r"""$$x^n + y^n = z^n $$"""  # Simple LaTeX expression
p6 = dedent(t"""
    Introduction: {intro:intro}

    {long}

    Examples:
    {examples:examples}

    Image reference:
    {img2:img}

    Latex:
    {latex:latex}

    Conclusion: This demonstrates all widget features working together.
    """)

intro = "This is a comprehensive test"
long = "a" * 240
p6 = dedent(t"""

    Introduction: {intro:intro}
    {long}


""")


def my_prompt():
    return p6


if __name__ == "__main__":
    run_preview(__file__, my_prompt)

