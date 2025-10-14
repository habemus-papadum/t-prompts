# toJSON Format Reference

The `toJSON()` method exports a complete structured prompt as a flat tree with ID-based references, optimized for analysis and external processing.

## Top-Level Structure

```python
{
  "tree": [<element>, <element>, ...],    # Flat list of all elements
  "id_to_path": {                          # Map from element ID to tree path
    "uuid-1": [0],                         # Root element at index 0
    "uuid-2": [3, 5],                      # Nested element
    ...
  }
}
```

### Fields

- **`tree`**: A flat array containing all elements (statics, interpolations, nested prompts, lists, images) in depth-first traversal order
- **`id_to_path`**: A mapping from element UUID strings to their paths in the tree (represented as arrays of integers)

## Element Types

Each element in the `tree` array is a dictionary with a `type` field indicating its kind.

### 1. Static Element

Represents literal text between interpolations.

```python
{
  "type": "static",
  "id": "uuid-string",
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
  "key": "prompt_key",
  "expression": "prompt_variable",
  "conversion": null,
  "format_spec": "prompt_key",
  "render_hints": "",
  "index": 3,
  "prompt_id": "uuid-of-nested-prompt",  # References the nested prompt's ID
  "source_location": { ... }
}
```

**Important**: The nested prompt's elements follow immediately after this element in the tree.

### 4. List Interpolation

Represents a list of StructuredPrompts.

```python
{
  "type": "list",
  "id": "uuid-string",
  "key": "items",
  "expression": "items_variable",
  "conversion": null,
  "format_spec": "items:sep=, ",
  "render_hints": "sep=, ",
  "separator": ", ",                    # Parsed separator (default: "\n")
  "item_ids": [                         # UUIDs of each item prompt
    "item-uuid-1",
    "item-uuid-2"
  ],
  "index": 5,
  "source_location": { ... }
}
```

**Important**: Each item's elements follow this element in the tree.

### 5. Image Interpolation

Represents a PIL Image object (requires PIL/Pillow).

```python
{
  "type": "image",
  "id": "uuid-string",
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

### Finding Elements by ID

The `id_to_path` mapping provides the path to any element:

```python
# Python example
def get_element_by_id(data, element_id):
    """Get element by its ID using the id_to_path mapping."""
    path = data["id_to_path"][element_id]
    # Path is a list of indices, but tree is flat
    # Just use the last index to get the element from tree
    tree_index = path[-1] if path else None
    return data["tree"][tree_index] if tree_index is not None else None
```

```javascript
// JavaScript example
function getElementById(data, elementId) {
  const path = data.id_to_path[elementId];
  if (!path || path.length === 0) return null;

  // Last index in path is the element's position in flat tree
  const treeIndex = path[path.length - 1];
  return data.tree[treeIndex];
}
```

### Finding Child Elements

Elements are stored in depth-first order. To find children of a nested prompt or list:

```python
def get_children(data, parent_element):
    """Get all child elements of a nested prompt or list."""
    parent_id = parent_element["id"]
    parent_path = data["id_to_path"][parent_id]

    children = []
    for elem in data["tree"]:
        elem_path = data["id_to_path"][elem["id"]]
        # Check if this element's path starts with parent's path
        # and is one level deeper
        if (len(elem_path) == len(parent_path) + 1 and
            elem_path[:len(parent_path)] == parent_path):
            children.append(elem)

    return children
```

### Walking the Tree

Process all elements in order:

```python
def walk_tree(data, callback):
    """Visit each element in the tree."""
    for element in data["tree"]:
        callback(element)

# Example: Print all interpolation values
def print_interpolations(data):
    def visitor(elem):
        if elem["type"] == "interpolation":
            print(f"{elem['key']}: {elem['value']}")

    walk_tree(data, visitor)
```

### Finding Root Elements

Root-level elements have single-element paths:

```python
def get_root_elements(data):
    """Get all elements at the root level."""
    return [
        elem for elem in data["tree"]
        if len(data["id_to_path"][elem["id"]]) == 1
    ]
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
    print(f"Total elements: {len(data['tree'])}")

    # Count element types
    type_counts = {}
    for elem in data["tree"]:
        t = elem["type"]
        type_counts[t] = type_counts.get(t, 0) + 1

    print("\nElement types:")
    for elem_type, count in sorted(type_counts.items()):
        print(f"  {elem_type}: {count}")

    # Find all interpolations
    print("\nInterpolations:")
    for elem in data["tree"]:
        if elem["type"] == "interpolation":
            path = data["id_to_path"][elem["id"]]
            depth = len(path) - 1
            indent = "  " * depth
            print(f"{indent}{elem['key']}: {elem['value']}")

    # Find nested prompts
    print("\nNested prompts:")
    for elem in data["tree"]:
        if elem["type"] == "nested_prompt":
            print(f"  {elem['key']} (prompt_id: {elem['prompt_id']})")

    # Find lists
    print("\nLists:")
    for elem in data["tree"]:
        if elem["type"] == "list":
            print(f"  {elem['key']}: {len(elem['item_ids'])} items")
            print(f"    separator: {repr(elem['separator'])}")

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
    Item 1: (from static in tree)

Nested prompts:
  nested (prompt_id: abc-123-def)

Lists:
  list: 2 items
    separator: '\n'
```

## Path Format

The `id_to_path` values are arrays of integers representing the element's location:

- `[0]` - First element at root level (tree index 0)
- `[3]` - Fourth element at root level (tree index 3)
- `[3, 5]` - Element at tree index 5, which is a child of element at index 3
- `[3, 5, 8]` - Element at tree index 8, grandchild of element 3 via element 5

The last integer in the path is always the element's index in the flat `tree` array.

## Language-Agnostic Pseudocode

Here's pseudocode for common operations:

```
// Get element by ID
function get_element(data, element_id):
    path = data.id_to_path[element_id]
    tree_index = path[length(path) - 1]
    return data.tree[tree_index]

// Check if element is a child of another
function is_child_of(data, child_id, parent_id):
    child_path = data.id_to_path[child_id]
    parent_path = data.id_to_path[parent_id]

    if length(child_path) != length(parent_path) + 1:
        return false

    for i from 0 to length(parent_path) - 1:
        if child_path[i] != parent_path[i]:
            return false

    return true

// Get nesting depth of element
function get_depth(data, element_id):
    path = data.id_to_path[element_id]
    return length(path) - 1

// Collect all values from interpolations
function collect_values(data):
    values = {}
    for element in data.tree:
        if element.type == "interpolation":
            values[element.key] = element.value
    return values
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
