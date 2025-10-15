# Features

Complete reference of all `t-prompts` features with examples.

## Dict-like Access

Access interpolations by key using familiar dictionary syntax.

```python
from t_prompts import prompt

instructions = "Be helpful"
p = prompt(t"{instructions:inst}")

# Access by key
node = p['inst']
print(node.value)  # "Be helpful"

# Check if key exists
assert 'inst' in p

# Iterate over keys
for key in p:
    print(key)  # "inst"

# Get all keys
print(list(p.keys()))  # ['inst']
```

## Nested Composition

Build complex prompts by composing smaller prompts into trees.

```python
from t_prompts import prompt

# Inner prompt
system = prompt(t"You are a {role:role}.")

# Outer prompt containing inner prompt
full = prompt(t"{system:sys} Now help the user.")

# Navigate nested structure
print(full['sys']['role'].value)  # Accesses nested role

# Multiple levels of nesting
level1 = prompt(t"Level 1: {data:d1}")
level2 = prompt(t"Level 2: {level1:l1}")
level3 = prompt(t"Level 3: {level2:l2}")

# Navigate three levels deep
print(level3['l2']['l1']['d1'].value)
```

## List Support

Interpolate lists of prompts with customizable separators.

```python
from t_prompts import prompt

# Create list of prompts
examples = [
    prompt(t"Example {i:num}: {text:txt}")
    for i, text in [(1, "First"), (2, "Second"), (3, "Third")]
]

# Default separator (newline)
p1 = prompt(t"Examples:\n{examples:ex}")
print(str(p1))
# Examples:
# Example 1: First
# Example 2: Second
# Example 3: Third

# Custom separator
p2 = prompt(t"Examples: {examples:ex:sep= | }")
print(str(p2))
# Examples: Example 1: First | Example 2: Second | Example 3: Third

# Empty separator (concatenate)
p3 = prompt(t"{examples:ex:sep=}")
```

## Render Hints

Transform output using rendering hints in the format spec.

### XML Wrapping

Wrap content in XML tags:

```python
from t_prompts import prompt

content = "This is my analysis."
p = prompt(t"{content:analysis:xml=thinking}")
print(str(p))
# <thinking>
# This is my analysis.
# </thinking>
```

### Markdown Headers

Add markdown headers:

```python
from t_prompts import prompt

task = "Translate to French"

# Header with custom text
p1 = prompt(t"{task:t:header=Task Description}")
print(str(p1))
# # Task Description
# Translate to French

# Header using the key
p2 = prompt(t"{task:Task:header}")
print(str(p2))
# # Task
# Translate to French
```

### Combining Hints

Use multiple hints together:

```python
from t_prompts import prompt

content = "My reasoning"
p = prompt(t"{content:reason:header=Analysis:xml=thinking}")
print(str(p))
# # Analysis
# <thinking>
# My reasoning
# </thinking>
```

## Dedenting Support

Write readable multi-line prompts with automatic indentation removal.

```python
from t_prompts import prompt

# Clean, indented source code
task = "summarize"
p = prompt(t"""
    You are a helpful assistant.

    Task: {task:t}

    Please respond concisely.
    """, dedent=True)

# Renders without indentation
print(str(p))
# You are a helpful assistant.
#
# Task: summarize
#
# Please respond concisely.
```

**Options**:

- `dedent=True`: Remove common indentation
- `trim_leading=True` (default): Remove first whitespace-only line
- `trim_empty_leading=True` (default): Remove empty lines after first
- `trim_trailing=True` (default): Remove trailing whitespace

## Format Spec Mini-Language

Flexible format specification syntax for keys and hints.

```python
from t_prompts import prompt

# No format spec - use expression as key
x = "value"
p1 = prompt(t"{x}")
assert 'x' in p1

# Underscore - explicitly use expression
p2 = prompt(t"{x:_}")
assert 'x' in p2

# Custom key
p3 = prompt(t"{x:custom_name}")
assert 'custom_name' in p3

# Key with hints
p4 = prompt(t"{x:key:xml=data:header=Section}")
assert 'key' in p4
assert p4['key'].render_hints == "xml=data:header=Section"
```

## Complete Source Mapping

Bidirectional mapping between rendered text and source structure.

### Text → Source Lookup

```python
from t_prompts import prompt

name = "Alice"
age = "30"
p = prompt(t"Name: {name:n}, Age: {age:a}")

rendered = p.render()

# Find what produced a character position
span = rendered.get_span_at(8)  # Position 8 is in "Alice"
print(span.key)  # "n"
print(span.element_type)  # "interpolation"
print(rendered.text[span.start:span.end])  # "Alice"
```

### Source → Text Lookup

```python
from t_prompts import prompt

name = "Bob"
p = prompt(t"Hello {name:n}!")

rendered = p.render()

# Find where a key was rendered
span = rendered.get_span_for_key("n")
print(rendered.text[span.start:span.end])  # "Bob"

# Find where a static was rendered
static_span = rendered.get_static_span(0)
print(rendered.text[static_span.start:static_span.end])  # "Hello "
```

### Element-based Lookup

```python
from t_prompts import prompt

# Each element has a unique ID
p = prompt(t"Value: {x:x}")
element = p['x']

# Find all spans for this element
rendered = p.render()
spans = rendered.get_spans_for_element(element.id)

# Find all spans for an entire prompt (includes nested)
all_spans = rendered.get_spans_for_prompt(p)
```

## Element Hierarchy

Unified access to both static text and interpolations.

```python
from t_prompts import prompt, Static, StructuredInterpolation

value = "test"
p = prompt(t"prefix {value:v} suffix")

# Access all elements
for elem in p.elements:
    if isinstance(elem, Static):
        print(f"Static[{elem.key}]: {elem.value!r}")
    elif isinstance(elem, StructuredInterpolation):
        print(f"Interpolation[{elem.key}]: {elem.value!r}")

# Output:
# Static[0]: 'prefix '
# Interpolation['v']: 'test'
# Static[1]: ' suffix'

# All elements have common properties
for elem in p.elements:
    print(f"Key: {elem.key}, Index: {elem.index}, Parent: {elem.parent is p}")
```

## Provenance Tracking

Complete metadata about every interpolation.

```python
from t_prompts import prompt

user = "Alice"
role = "admin"
p = prompt(t"User {user:u!r} has role {role:r}")

# Access metadata
node = p['u']
print(node.expression)   # "user"
print(node.value)        # "Alice"
print(node.conversion)   # "r" (from !r)
print(node.format_spec)  # "u"
print(node.key)          # "u"
print(node.index)        # 1 (second element after first static)
```

## Conversions

Support for string conversions from t-strings.

```python
from t_prompts import prompt

value = "hello"
obj = {"key": "value"}

# String conversion (!s)
p1 = prompt(t"{value:v!s}")
assert p1['v'].conversion == "s"

# Repr conversion (!r)
p2 = prompt(t"{value:v!r}")
print(str(p2))  # "'hello'" (with quotes)

# ASCII conversion (!a)
p3 = prompt(t"{value:v!a}")
assert p3['v'].conversion == "a"

# Conversions are applied during rendering
print(p2['v'].render())  # "'hello'"
```

## JSON Export

Serialize prompts to JSON for logging or transmission.

### toJSON()

Export complete structure as hierarchical tree with explicit children arrays (optimized for analysis):

```python
from t_prompts import prompt
import json

# Create nested prompt
inner = "inner_value"
outer = "outer_value"
p_inner = prompt(t"{inner:i}")
p_outer = prompt(t"{outer:o} {p_inner:nested}")

data = p_outer.toJSON()
print(json.dumps(data, indent=2))
# {
#   "prompt_id": "root-uuid",
#   "children": [
#     {"type": "static", "id": "...", "parent_id": "root-uuid", "key": 0, "value": "", ...},
#     {"type": "interpolation", "id": "...", "parent_id": "root-uuid", "key": "o", "value": "outer_value", ...},
#     {"type": "static", "id": "...", "parent_id": "root-uuid", "key": 1, "value": " ", ...},
#     {
#       "type": "nested_prompt",
#       "id": "...",
#       "parent_id": "root-uuid",
#       "key": "nested",
#       "prompt_id": "...",
#       "children": [
#         {"type": "static", "id": "...", "parent_id": "...", "key": 0, "value": "", ...},
#         {"type": "interpolation", "id": "...", "parent_id": "...", "key": "i", "value": "inner_value", ...},
#         {"type": "static", "id": "...", "parent_id": "...", "key": 1, "value": "", ...}
#       ],
#       ...
#     },
#     {"type": "static", "id": "...", "parent_id": "root-uuid", "key": 2, "value": "", ...}
#   ]
# }
```

**Key features**:
- **Hierarchical tree**: Natural tree structure with explicit `children` arrays
- **Parent references**: Each element has `parent_id` for bidirectional navigation
- **Direct containment**: Nested prompts contain their children directly (not by ID reference)
- **Image support**: Images serialized as base64 with metadata (format, size, mode)
- **Complete metadata**: Includes source location, render hints, conversions, format specs

**Use cases**:
- Complex prompt analysis and debugging
- External tools processing prompt structure
- Database storage with relational queries
- Correlation with rendered output (via element IDs)

## Type Validation

Only strings, prompts, and lists of prompts are allowed.

```python
from t_prompts import prompt, UnsupportedValueTypeError

# ✓ Strings allowed
p1 = prompt(t"{name:n}")

# ✓ Nested prompts allowed
inner = prompt(t"{x:x}")
p2 = prompt(t"{inner:i}")

# ✓ Lists of prompts allowed
items = [prompt(t"{x:x}") for x in ["a", "b"]]
p3 = prompt(t"{items:items}")

# ✗ Integers not allowed
try:
    p4 = prompt(t"{42:num}")
except UnsupportedValueTypeError as e:
    print(f"Error: {e}")

# ✗ Objects not allowed
try:
    obj = {"key": "value"}
    p5 = prompt(t"{obj:o}")
except UnsupportedValueTypeError as e:
    print(f"Error: {e}")
```

## Immutable Design

All elements are frozen dataclasses that cannot be modified.

```python
from t_prompts import prompt

p = prompt(t"{x:x}")
node = p['x']

# Cannot modify
try:
    node.value = "new value"  # ✗ Raises FrozenInstanceError
except Exception as e:
    print(f"Cannot modify: {type(e).__name__}")

# Elements use slots for memory efficiency
print(node.__slots__)  # Shows defined fields only
```

## Source Location Tracking

Automatically tracks where prompts are created in your source code.

```python
from t_prompts import prompt

# Source location captured by default
x = "value"
p = prompt(t"{x:x}")

loc = p['x'].source_location
if loc.is_available:
    print(f"Created at {loc.filename}:{loc.line}")
    print(f"Full path: {loc.filepath}")

# Disable for performance
p2 = prompt(t"{x:x}", capture_source_location=False)
assert p2['x'].source_location is None
```

## Next Steps

- [Use Cases](use-cases.md) - See real-world applications
- [Quick Start](quick-start.md) - Learn the basics
- [Tutorials](demos/01-basic.ipynb) - Interactive guides
- [API Reference](reference.md) - Complete API documentation
