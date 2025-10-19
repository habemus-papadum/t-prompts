# Repository Coverage

[Full report](https://htmlpreview.github.io/?https://github.com/habemus-papadum/t-prompts/blob/python-coverage-comment-action-data/htmlcov/index.html)

| Name                                   |    Stmts |     Miss |   Cover |   Missing |
|--------------------------------------- | -------: | -------: | ------: | --------: |
| src/t\_prompts/\_\_init\_\_.py         |       11 |        0 |    100% |           |
| src/t\_prompts/diff.py                 |      373 |       89 |     76% |204-210, 234-236, 239-248, 261-267, 278-303, 365, 378-384, 401-412, 500, 513-514, 541, 548, 574, 578, 604, 615, 633, 661, 722, 758-770, 773-775, 787-789 |
| src/t\_prompts/element.py              |      168 |       32 |     81% |34, 86-88, 141, 162, 176, 214, 235, 278, 296, 390, 406, 464, 478-484, 522, 526, 530, 554, 573, 591, 650, 675, 698, 718-719 |
| src/t\_prompts/exceptions.py           |       46 |        2 |     96% |   73, 109 |
| src/t\_prompts/ir.py                   |      181 |       12 |     93% |98-99, 113-115, 274-276, 323, 359, 410, 490, 787 |
| src/t\_prompts/parsing.py              |       33 |        0 |    100% |           |
| src/t\_prompts/source\_location.py     |       40 |        3 |     92% |72, 101, 107 |
| src/t\_prompts/structured\_prompt.py   |      224 |        6 |     97% |274, 316, 559-562 |
| src/t\_prompts/text.py                 |       68 |        5 |     93% |48, 66, 110, 136, 145 |
| src/t\_prompts/widgets/\_\_init\_\_.py |        7 |        0 |    100% |           |
| src/t\_prompts/widgets/config.py       |       17 |        1 |     94% |        72 |
| src/t\_prompts/widgets/export.py       |       30 |        0 |    100% |           |
| src/t\_prompts/widgets/preview.py      |      252 |      222 |     12% |36-37, 44-46, 50-111, 115-126, 131-135, 142-145, 149-164, 193-319, 335, 395-402, 462-587, 595-630, 640 |
| src/t\_prompts/widgets/renderer.py     |       26 |        6 |     77% |     27-43 |
| src/t\_prompts/widgets/utils.py        |        9 |        4 |     56% |     48-54 |
| src/t\_prompts/widgets/widget.py       |        5 |        0 |    100% |           |
|                              **TOTAL** | **1490** |  **382** | **74%** |           |


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