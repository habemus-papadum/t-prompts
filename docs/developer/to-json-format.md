# toJSON Format Reference

The `toJSON()` method exports a complete structured prompt as a hierarchical tree with explicit children arrays and parent references, optimized for analysis and external processing.

## Top-Level Structure

```python
{
  "prompt_id": "root-uuid",         # UUID of the root StructuredPrompt
  "children": [                     # Array of child elements
    {
      "type": "static",
      "id": "uuid-1",
      "parent_id": "root-uuid",
      "key": 0,
      "value": "...",
      ...
    },
    {
      "type": "nested_prompt",
      "id": "uuid-2",
      "parent_id": "root-uuid",
      "prompt_id": "nested-uuid",
      "children": [                  # Nested children
        ...
      ],
      ...
    },
    ...
  ]
}
```

### Fields

- **`prompt_id`**: UUID of the root StructuredPrompt
- **`children`**: Array of child elements, each with their own `children` if nested

## Element Types

Each element in the `children` array is a dictionary with a `type` field indicating its kind. All elements include a `parent_id` field referencing their parent element by UUID.

### 1. Static Element

Represents literal text between interpolations.

```python
{
  "type": "static",
  "id": "uuid-string",
  "parent_id": "parent-uuid",  # UUID of parent element
  "key": 0,                    # Integer index in strings tuple
  "value": "literal text",
  "index": 0,                  # Position in parent's element sequence
  "source_location": {         # Or null if unavailable
    "filename": "script.py",
    "filepath": "/path/to/script.py",
    "line": 42
  }
}
```

### 2. String Interpolation

Represents a simple string interpolation (not a nested prompt).

```python
{
  "type": "interpolation",
  "id": "uuid-string",
  "parent_id": "parent-uuid",        # UUID of parent element
  "key": "variable_name",            # String key from format spec
  "expression": "variable_name",     # Original expression in {}
  "conversion": "r",                 # "r", "s", "a", or null
  "format_spec": "variable_name",    # Full format spec string
  "render_hints": "",                # Parsed render hints (after first :)
  "value": "interpolated value",
  "index": 1,
  "source_location": { ... }         # Or null
}
```

### 3. Nested Prompt

Represents an interpolation containing another StructuredPrompt.

```python
{
  "type": "nested_prompt",
  "id": "uuid-string",
  "parent_id": "parent-uuid",            # UUID of parent element
  "key": "prompt_key",
  "expression": "prompt_variable",
  "conversion": null,
  "format_spec": "prompt_key",
  "render_hints": "",
  "index": 3,
  "prompt_id": "uuid-of-nested-prompt",  # References the nested prompt's ID
  "children": [                          # Nested prompt's elements
    {
      "type": "static",
      "id": "...",
      "parent_id": "uuid-string",        # References this nested_prompt element
      ...
    },
    ...
  ],
  "source_location": { ... }
}
```

**Important**: The nested prompt's elements are contained in the `children` array.

### 4. List Interpolation

Represents a list of StructuredPrompts.

```python
{
  "type": "list",
  "id": "uuid-string",
  "parent_id": "parent-uuid",           # UUID of parent element
  "key": "items",
  "expression": "items_variable",
  "conversion": null,
  "format_spec": "items:sep=, ",
  "render_hints": "sep=, ",
  "separator": ", ",                    # Parsed separator (default: "\n")
  "children": [                         # Array of child prompt structures
    {
      "prompt_id": "item-uuid-1",       # UUID of first item prompt
      "children": [                     # First item's elements
        ...
      ]
    },
    {
      "prompt_id": "item-uuid-2",       # UUID of second item prompt
      "children": [                     # Second item's elements
        ...
      ]
    }
  ],
  "index": 5,
  "source_location": { ... }
}
```

**Important**: Each item is represented as `{"prompt_id": "...", "children": [...]}` in the `children` array.

### 5. Image Interpolation

Represents a PIL Image object (requires PIL/Pillow).

```python
{
  "type": "image",
  "id": "uuid-string",
  "parent_id": "parent-uuid",           # UUID of parent element
  "key": "image_key",
  "expression": "img",
  "conversion": null,
  "format_spec": "image_key",
  "render_hints": "",
  "image_data": {                       # Serialized image
    "base64_data": "iVBORw0KGg...",    # Base64-encoded image
    "format": "PNG",                    # Image format (PNG, JPEG, etc.)
    "width": 100,                       # Image width in pixels
    "height": 200,                      # Image height in pixels
    "mode": "RGB"                       # Color mode (RGB, RGBA, L, etc.)
  },
  "index": 7,
  "source_location": { ... }
}
```

## Traversing the Tree

The hierarchical structure with explicit `children` arrays makes traversal natural and intuitive.

### Walking the Tree Recursively

Process all elements in depth-first order:

```python
def walk_tree(children, callback, depth=0):
    """Visit each element recursively."""
    for element in children:
        callback(element, depth)

        # Recurse into nested children
        if "children" in element:
            if isinstance(element["children"], list):
                # Could be regular children or list items
                if element["children"] and "prompt_id" in element["children"][0]:
                    # List items - recurse into each
                    for item in element["children"]:
                        walk_tree(item["children"], callback, depth + 1)
                else:
                    # Regular element children
                    walk_tree(element["children"], callback, depth + 1)

# Example: Print all elements with indentation
def print_structure(data):
    def visitor(elem, depth):
        indent = "  " * depth
        if elem["type"] == "interpolation":
            print(f"{indent}{elem['key']}: {elem['value']}")
        elif elem["type"] == "nested_prompt":
            print(f"{indent}[nested: {elem['key']}]")
        elif elem["type"] == "list":
            print(f"{indent}[list: {elem['key']}]")
        elif elem["type"] == "static":
            print(f"{indent}(static: {repr(elem['value'][:20])}...)")

    walk_tree(data["children"], visitor)
```

### Finding Elements by Parent ID

Find all direct children of an element:

```python
def get_children(element):
    """Get direct children of an element."""
    if "children" not in element:
        return []

    children = element["children"]

    # Handle list items (which have prompt_id and children)
    if children and isinstance(children[0], dict) and "prompt_id" in children[0]:
        # This is a list - return the list item structures
        return children

    # Regular element children
    return children
```

### Finding Parent Element

Navigate upward using `parent_id`:

```python
def find_element_by_id(children, target_id):
    """Recursively find an element by its ID."""
    for elem in children:
        if elem["id"] == target_id:
            return elem

        if "children" in elem:
            if elem["children"] and isinstance(elem["children"][0], dict):
                if "prompt_id" in elem["children"][0]:
                    # List items
                    for item in elem["children"]:
                        result = find_element_by_id(item["children"], target_id)
                        if result:
                            return result
                else:
                    # Regular children
                    result = find_element_by_id(elem["children"], target_id)
                    if result:
                        return result
    return None

def get_parent(data, element):
    """Get the parent element using parent_id."""
    parent_id = element["parent_id"]

    # Check if parent is root
    if parent_id == data["prompt_id"]:
        return None  # Root has no parent element

    # Find parent element in tree
    return find_element_by_id(data["children"], parent_id)
```

### Collecting All Interpolations

```python
def collect_interpolations(data):
    """Collect all interpolation values."""
    values = {}

    def visitor(elem, depth):
        if elem["type"] == "interpolation":
            values[elem["key"]] = elem["value"]

    walk_tree(data["children"], visitor)
    return values
```

## Example: Complete Traversal

Here's a complete example showing how to traverse and analyze a toJSON export:

```python
import json
from t_prompts import prompt

# Create a complex prompt
inner = "inner_value"
p_inner = prompt(t"{inner:i}")
items = [prompt(t"Item 1"), prompt(t"Item 2")]
p = prompt(t"Text: {p_inner:nested} {items:list}")

# Export to JSON
data = p.toJSON()

# Analyze the structure
def analyze_prompt(data):
    # Count elements recursively
    def count_elements(children):
        count = 0
        for elem in children:
            count += 1
            if "children" in elem:
                if elem["children"] and isinstance(elem["children"][0], dict):
                    if "prompt_id" in elem["children"][0]:
                        # List items
                        for item in elem["children"]:
                            count += count_elements(item["children"])
                    else:
                        # Regular children
                        count += count_elements(elem["children"])
        return count

    total = count_elements(data["children"])
    print(f"Total elements: {total}")

    # Count element types
    type_counts = {}

    def count_types(children):
        for elem in children:
            t = elem["type"]
            type_counts[t] = type_counts.get(t, 0) + 1

            if "children" in elem:
                if elem["children"] and isinstance(elem["children"][0], dict):
                    if "prompt_id" in elem["children"][0]:
                        for item in elem["children"]:
                            count_types(item["children"])
                    else:
                        count_types(elem["children"])

    count_types(data["children"])

    print("\nElement types:")
    for elem_type, count in sorted(type_counts.items()):
        print(f"  {elem_type}: {count}")

    # Find all interpolations with depth
    print("\nInterpolations:")

    def print_interps(children, depth=0):
        for elem in children:
            if elem["type"] == "interpolation":
                indent = "  " * depth
                print(f"{indent}{elem['key']}: {elem['value']}")

            if "children" in elem:
                if elem["children"] and isinstance(elem["children"][0], dict):
                    if "prompt_id" in elem["children"][0]:
                        for item in elem["children"]:
                            print_interps(item["children"], depth + 1)
                    else:
                        print_interps(elem["children"], depth + 1)

    print_interps(data["children"])

    # Find nested prompts
    print("\nNested prompts:")

    def find_nested(children):
        for elem in children:
            if elem["type"] == "nested_prompt":
                print(f"  {elem['key']} (prompt_id: {elem['prompt_id']})")

            if "children" in elem:
                if elem["children"] and isinstance(elem["children"][0], dict):
                    if "prompt_id" in elem["children"][0]:
                        for item in elem["children"]:
                            find_nested(item["children"])
                    else:
                        find_nested(elem["children"])

    find_nested(data["children"])

    # Find lists
    print("\nLists:")

    def find_lists(children):
        for elem in children:
            if elem["type"] == "list":
                print(f"  {elem['key']}: {len(elem['children'])} items")
                print(f"    separator: {repr(elem['separator'])}")

            if "children" in elem:
                if elem["children"] and isinstance(elem["children"][0], dict):
                    if "prompt_id" in elem["children"][0]:
                        for item in elem["children"]:
                            find_lists(item["children"])
                    else:
                        find_lists(elem["children"])

    find_lists(data["children"])

analyze_prompt(data)
```

Output:
```
Total elements: 10

Element types:
  interpolation: 2
  list: 1
  nested_prompt: 1
  static: 6

Interpolations:
  i: inner_value

Nested prompts:
  nested (prompt_id: abc-123-def)

Lists:
  list: 2 items
    separator: '\n'
```

## Language-Agnostic Pseudocode

Here's pseudocode for common operations with the hierarchical structure:

```
// Walk tree recursively
function walk_tree(children, callback, depth=0):
    for element in children:
        callback(element, depth)

        if "children" in element:
            if element.children is list and length(element.children) > 0:
                if "prompt_id" in element.children[0]:
                    // List items
                    for item in element.children:
                        walk_tree(item.children, callback, depth + 1)
                else:
                    // Regular children
                    walk_tree(element.children, callback, depth + 1)

// Find element by ID recursively
function find_by_id(children, target_id):
    for element in children:
        if element.id == target_id:
            return element

        if "children" in element:
            if element.children is list and length(element.children) > 0:
                if "prompt_id" in element.children[0]:
                    for item in element.children:
                        result = find_by_id(item.children, target_id)
                        if result != null:
                            return result
                else:
                    result = find_by_id(element.children, target_id)
                    if result != null:
                        return result
    return null

// Collect all interpolation values
function collect_values(children):
    values = {}

    function visit(elem, depth):
        if elem.type == "interpolation":
            values[elem.key] = elem.value

    walk_tree(children, visit)
    return values

// Get nesting depth
function get_depth(data, element):
    // Count parent_id chain back to root
    depth = 0
    current_id = element.parent_id

    while current_id != data.prompt_id:
        parent = find_by_id(data.children, current_id)
        if parent == null:
            break
        current_id = parent.parent_id
        depth += 1

    return depth
```

## Use Cases

The toJSON format is designed for:

1. **External analysis tools**: Process prompt structure without Python dependencies
2. **Database storage**: Store prompts in relational or document databases
3. **Debugging**: Inspect complete prompt structure with all metadata
4. **Optimization**: Analyze prompt complexity and token usage
5. **Correlation with rendering**: Use element IDs to map rendered output back to source

## Next Steps

- See the [Features documentation](../features.md) for `toJSON()` usage examples
- Check [Developer Setup](setup.md) for development environment setup
- Read the [Architecture documentation](../Architecture.md) for system design
