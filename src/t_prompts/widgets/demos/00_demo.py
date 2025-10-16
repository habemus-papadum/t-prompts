from t_prompts import prompt
from t_prompts.widgets import run_preview


def my_prompt():
    name = """ Wors gfdgdf gdfgdf gdfgdf dfg dfgdfg  dfgdf dfg dfg    dfgdfgfd dfsld.s

    sdfdsfsdfds

    """
    return prompt(t"Hello {name:n}")


if __name__ == "__main__":
    run_preview(__file__, my_prompt)
