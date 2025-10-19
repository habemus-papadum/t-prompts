from PIL import Image

from t_prompts import dedent, prompt
from t_prompts.widgets import run_preview

# Combine everything
intro = "This is a comprehensive test"
examples = [prompt(t"- Example {str(i):{i}}") for i in range(3)]
img2 = Image.new("RGB", (50, 50), color="red")
long = "a" * 240
latex_term_a = "x^n"
latex_term_b = "y^n"
latex_term_c = "z^n"
latex = dedent(t"""
    $${latex_term_a:latex_term_a} + {latex_term_b:latex_term_b} = {latex_term_c:latex_term_c}$$
""")  # Simple LaTeX expression with interpolations
code = dedent(t"""
    # Sample code block
    def hello_world():
        print("{intro:world}!")
    """)
p6 = dedent(t"""
    Introduction: {intro:intro}

    {long}

    Examples:
    {examples:examples}

    Image reference:
    {img2:img}

    Latex:
    {latex:latex}

    ```python
    # Sample code block
    def hello_world():
        print("Hello, world!")
    ```

    ```python
    {code:code}
    ```

    ```python
    # Sample code block
    def hello_world():
        print("{intro:world}!")
    ```


    Conclusion: This demonstrates all widget features working together.
    """)

intro = "This is a comprehensive test"
long = "a" * 240


def my_prompt():
    return p6


if __name__ == "__main__":
    run_preview(__file__, my_prompt)
