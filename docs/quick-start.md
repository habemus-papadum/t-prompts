# Quick Start

This guide will walk you through the core features of `t-prompts` with practical examples.

## Basic Usage

Create a simple prompt with labeled interpolation:

```python
from t_prompts import prompt

# Simple prompt with labeled interpolation
instructions = "Always answer politely."
p = prompt(t"Obey {instructions:inst}")

# Renders like an f-string
assert str(p) == "Obey Always answer politely."

# But preserves provenance
node = p['inst']
assert node.expression == "instructions"  # Original variable name
assert node.value == "Always answer politely."
```

## Composing Prompts

Build complex prompts from smaller, reusable pieces:

```python
# Build prompts from smaller pieces
system_msg = "You are a helpful assistant."
user_query = "What is Python?"

p_system = prompt(t"{system_msg:system}")
p_user = prompt(t"User: {user_query:query}")

# Compose into larger prompt
p_full = prompt(t"{p_system:sys} {p_user:usr}")

# Renders correctly
print(str(p_full))
# "You are a helpful assistant. User: What is Python?"

# Navigate the tree
assert p_full['sys']['system'].value == "You are a helpful assistant."
assert p_full['usr']['query'].value == "What is Python?"
```

## Lists of Prompts

Interpolate lists of `StructuredPrompt` objects with customizable separators:

```python
# Create a list of example prompts
examples = [
    prompt(t"{ex:example}") for ex in [
        "The cat sat on the mat.",
        "Python is great.",
        "AI is fascinating."
    ]
]

# Interpolate the list with default separator (newline)
p = prompt(t"Examples:\n{examples:examples}")
print(str(p))
# Examples:
# The cat sat on the mat.
# Python is great.
# AI is fascinating.

# Use custom separator with render hints
p2 = prompt(t"Examples: {examples:examples:sep= | }")
print(str(p2))
# Examples: The cat sat on the mat. | Python is great. | AI is fascinating.
```

**Separator syntax**: Use `sep=<value>` in render hints to specify a custom separator. The default is a newline (`\n`).

## Dedenting for Readability

When writing multi-line prompts in your source code, indentation can make the code hard to read. The `dedent=True` parameter automatically removes common indentation:

```python
def create_prompt(task, context):
    # Without dedent: awkward to write
    p_awkward = prompt(t"""You are a helpful assistant.
Task: {task:t}
Context: {context:c}
Please help.""")

    # With dedent: clean and readable
    p_clean = prompt(t"""
        You are a helpful assistant.
        Task: {task:t}
        Context: {context:c}
        Please help.
        """, dedent=True)

    # Both render to the same output:
    # "You are a helpful assistant.\nTask: ...\nContext: ...\nPlease help."
    assert str(p_awkward) == str(p_clean)
```

**Dedenting options** (all keyword-only):

- `dedent=False` (default): No dedenting, text used as-is
- `trim_leading=True` (default): Remove first line if it's whitespace-only
- `trim_empty_leading=True` (default): Remove empty lines after the first line
- `trim_trailing=True` (default): Remove trailing whitespace lines

**How it works:**

1. First line of first static (usually just `\n`) is removed (if `trim_leading=True`)
2. Empty lines after that are removed (if `trim_empty_leading=True`)
3. If `dedent=True`, find the first non-empty line's indentation and remove that many spaces from all lines
4. Trailing whitespace lines are removed (if `trim_trailing=True`)

**Example with all features:**

```python
task = "translate to French"
examples = [
    prompt(t"English: {eng:eng} -> French: {fr:fr}")
    for eng, fr in [("hello", "bonjour"), ("goodbye", "au revoir")]
]

p = prompt(t"""
    Task: {task:t}

    Examples:
    {examples:ex}

    Now translate:
    """, dedent=True)

print(str(p))
# Task: translate to French
#
# Examples:
# English: hello -> French: bonjour
# English: goodbye -> French: au revoir
#
# Now translate:
```

**Note**: The trim options are ON by default, so even without `dedent=True`, leading and trailing whitespace lines are removed. Set them to `False` to preserve original formatting.

## Provenance Access

Access metadata about interpolations for logging and debugging:

```python
context = "User is Alice"
instructions = "Be concise"

p = prompt(t"Context: {context:ctx}. {instructions:inst}")

# Access metadata for each interpolation
ctx_node = p['ctx']
print(ctx_node.expression)  # "context"
print(ctx_node.value)  # "User is Alice"
print(ctx_node.key)  # "ctx"

# Export complete structure to JSON
data = p.toJSON()
# Hierarchical tree with all elements, metadata, and IDs
```

## Format Spec Mini-Language

Format specs follow the pattern `key : render_hints`:

- **No format spec**: `{var}` → key = `"var"`
- **Underscore**: `{var:_}` → key = `"var"` (explicitly use expression)
- **Simple key**: `{var:custom_key}` → key = `"custom_key"`, no hints
- **With hints**: `{var:key:hint1:hint2}` → key = `"key"`, hints = `"hint1:hint2"`

```python
from t_prompts import prompt

# Simple keying
x = "X"
p1 = prompt(t"{x:custom_key}")
assert 'custom_key' in p1

# With render hints
data = '{"name": "Alice"}'
p2 = prompt(t"{data:user_data:format=json,indent=2}")
assert 'user_data' in p2
assert p2['user_data'].render_hints == "format=json,indent=2"

# Use expression as key
value = "test"
p3 = prompt(t"{value:_}")
assert 'value' in p3
```

**Supported render hints**:
- `xml=<tag>`: Wraps the interpolation in XML tags: `<tag>content</tag>`
- `header` or `header=<text>`: Prepends a markdown header (e.g., `# Header`)
- `sep=<separator>`: Custom separator for list interpolations (default: `\n`)

Example with render hints:

```python
instructions = prompt(t"Be helpful")
p = prompt(t"{instructions:inst:xml=instructions:header=System}")
print(str(p))
# # System
# <instructions>
# Be helpful
# </instructions>
```

## Source Mapping

`render()` returns an `IntermediateRepresentation` with bidirectional text ↔ structure mapping:

```python
from t_prompts import prompt

name = "Alice"
age = "30"
p = prompt(t"Name: {name:n}, Age: {age:a}")

rendered = p.render()

# Access the text
print(rendered.text)  # "Name: Alice, Age: 30"

# Find what produced a position in the text
span = rendered.get_span_at(8)  # Position 8 is in "Alice"
print(span.key)  # "n"
print(rendered.text[span.start:span.end])  # "Alice"

# Find where a key was rendered
span = rendered.get_span_for_key("a")
print(rendered.text[span.start:span.end])  # "30"

# Access the original prompt
assert rendered.source_prompt is p

# str() for convenience
assert str(p) == rendered.text
```

## Elements and Static Text

As of version 0.4.0, `t-prompts` provides unified access to **all** parts of your prompt through the `Element` base class:

- **`Static`**: Represents literal text segments between interpolations
- **`StructuredInterpolation`**: Represents interpolated values

Both extend the `Element` base class, giving you complete visibility into your prompt's structure:

```python
from t_prompts import prompt

value = "test"
p = prompt(t"prefix {value:v} suffix")

# Access all elements (statics and interpolations)
elements = p.elements
print(len(elements))  # 3: Static("prefix "), Interpolation(v), Static(" suffix")

# Each element has key, parent, index, and value
for elem in elements:
    print(f"{elem.__class__.__name__}: key={elem.key}, index={elem.index}")
# Static: key=0, index=0
# StructuredInterpolation: key='v', index=1
# Static: key=1, index=2

# Static elements use integer keys (position in template strings tuple)
# Interpolations use string keys (from format spec or expression)
```

**Source mapping for static text**: The source map now includes spans for static text segments too:

```python
name = "Alice"
p = prompt(t"Hello {name:n}!")

rendered = p.render()

# Find static text at position 0
span = rendered.get_span_at(0)  # Position 0 is in "Hello "
print(span.element_type)  # "static"
print(span.key)  # 0 (first static segment)
print(rendered.text[span.start:span.end])  # "Hello "

# Or use the helper method
static_span = rendered.get_static_span(0)
print(rendered.text[static_span.start:static_span.end])  # "Hello "

# Interpolations work the same way
interp_span = rendered.get_interpolation_span("n")
print(rendered.text[interp_span.start:interp_span.end])  # "Alice"
```

**Why this matters**: Complete source mapping enables powerful tooling for:

- Highlighting and navigating entire prompts in UIs
- Tracking which parts of a prompt came from templates vs. variables
- Debugging and auditing LLM inputs with full context
- Building editors that understand prompt structure

## Next Steps

- [Use Cases](use-cases.md) - See what you can build with t-prompts
- [Features](features.md) - Explore all capabilities in detail
- [Tutorials](demos/01-basic.ipynb) - Step-by-step interactive guides
- [Topics](demos/topics/few-shot-prompts.ipynb) - Deep dives into specific features
