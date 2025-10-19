# Repository Coverage

[Full report](https://htmlpreview.github.io/?https://github.com/habemus-papadum/t-prompts/blob/python-coverage-comment-action-data/htmlcov/index.html)

| Name                                   |    Stmts |     Miss |   Cover |   Missing |
|--------------------------------------- | -------: | -------: | ------: | --------: |
| src/t\_prompts/\_\_init\_\_.py         |       11 |        0 |    100% |           |
| src/t\_prompts/diff.py                 |      379 |       51 |     87% |49-51, 54-63, 145, 161, 254-255, 268, 293, 300, 323, 327, 368, 373, 376-379, 413, 424, 442, 470, 531, 567-579, 582-584, 596-598, 618, 686 |
| src/t\_prompts/element.py              |      168 |       32 |     81% |35, 87-89, 142, 163, 177, 215, 236, 279, 297, 391, 407, 465, 479-486, 524, 528, 532, 556, 575, 593, 652, 677, 700, 720-721 |
| src/t\_prompts/exceptions.py           |       46 |        2 |     96% |   73, 108 |
| src/t\_prompts/ir.py                   |      181 |       12 |     93% |98-99, 113-115, 274-276, 323, 359, 410, 490, 787 |
| src/t\_prompts/parsing.py              |       33 |        0 |    100% |           |
| src/t\_prompts/source\_location.py     |       40 |        3 |     92% |72, 101, 107 |
| src/t\_prompts/structured\_prompt.py   |      224 |        6 |     97% |274, 316, 559-562 |
| src/t\_prompts/text.py                 |       68 |        5 |     93% |48, 66, 110, 136, 145 |
| src/t\_prompts/widgets/\_\_init\_\_.py |        7 |        0 |    100% |           |
| src/t\_prompts/widgets/config.py       |       17 |        1 |     94% |        72 |
| src/t\_prompts/widgets/export.py       |       30 |        0 |    100% |           |
| src/t\_prompts/widgets/preview.py      |      252 |      222 |     12% |37-38, 45-47, 51-113, 117-128, 133-137, 144-147, 151-166, 193-319, 335, 395-402, 462-589, 597-633, 643 |
| src/t\_prompts/widgets/renderer.py     |       26 |        6 |     77% |     27-43 |
| src/t\_prompts/widgets/utils.py        |        9 |        4 |     56% |     48-53 |
| src/t\_prompts/widgets/widget.py       |        5 |        0 |    100% |           |
|                              **TOTAL** | **1496** |  **344** | **77%** |           |


## Setup coverage badge

Below are examples of the badges you can use in your main branch `README` file.

### Direct image

[![Coverage badge](https://raw.githubusercontent.com/habemus-papadum/t-prompts/python-coverage-comment-action-data/badge.svg)](https://htmlpreview.github.io/?https://github.com/habemus-papadum/t-prompts/blob/python-coverage-comment-action-data/htmlcov/index.html)

This is the one to use if your repository is private or if you don't want to customize anything.

### [Shields.io](https://shields.io) Json Endpoint

[![Coverage badge](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/habemus-papadum/t-prompts/python-coverage-comment-action-data/endpoint.json)](https://htmlpreview.github.io/?https://github.com/habemus-papadum/t-prompts/blob/python-coverage-comment-action-data/htmlcov/index.html)

Using this one will allow you to [customize](https://shields.io/endpoint) the look of your badge.
It won't work with private repositories. It won't be refreshed more than once per five minutes.

### [Shields.io](https://shields.io) Dynamic Badge

[![Coverage badge](https://img.shields.io/badge/dynamic/json?color=brightgreen&label=coverage&query=%24.message&url=https%3A%2F%2Fraw.githubusercontent.com%2Fhabemus-papadum%2Ft-prompts%2Fpython-coverage-comment-action-data%2Fendpoint.json)](https://htmlpreview.github.io/?https://github.com/habemus-papadum/t-prompts/blob/python-coverage-comment-action-data/htmlcov/index.html)

This one will always be the same color. It won't work for private repos. I'm not even sure why we included it.

## What is that?

This branch is part of the
[python-coverage-comment-action](https://github.com/marketplace/actions/python-coverage-comment)
GitHub Action. All the files in this branch are automatically generated and may be
overwritten at any moment.