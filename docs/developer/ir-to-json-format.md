# IntermediateRepresentation toJSON Format Reference

The `toJSON()` method exports a complete IntermediateRepresentation as JSON with bidirectional source mapping, optimized for analysis, debugging, and provenance tracking.

## Overview

An IntermediateRepresentation (IR) bridges structured prompts and their rendered output. The `toJSON()` method provides a comprehensive JSON representation that includes:

1. **Source Prompt**: Complete hierarchical structure from `StructuredPrompt.toJSON()`
2. **Rendered Chunks**: Array of text/image chunks with metadata
3. **Chunk Lookup**: Fast ID-to-index mapping for chunk access
4. **Bidirectional Source Map**: Maps between source elements and rendered output

## Top-Level Structure

```json
{
  "ir_id": "uuid-string",
  "source_prompt": { /* hierarchical StructuredPrompt structure */ },
  "chunks": [ /* array of rendered chunks */ ],
  "chunk_id_to_index": { /* chunk ID → index lookup */ },
  "source_map": [ /* array of source spans */ ]
}
```

### Fields

- **`ir_id`**: UUID of this IntermediateRepresentation instance
- **`source_prompt`**: Complete hierarchical JSON from `StructuredPrompt.toJSON()` (see [toJSON Format](to-json-format.md))
- **`chunks`**: Array of rendered output chunks (text or image)
- **`chunk_id_to_index`**: Lookup table mapping chunk UUIDs to their array indices
- **`source_map`**: Array of source spans enabling bidirectional mapping

## Chunks Array

The `chunks` array contains the rendered output, supporting both text and image chunks.

### Text Chunk

```json
{
  "type": "text",
  "id": "uuid-string",
  "chunk_index": 0,
  "text": "rendered text content"
}
```

**Fields**:
- `type`: Always `"text"` for text chunks
- `id`: Unique UUID for this chunk
- `chunk_index`: Position in the chunks array (0-indexed)
- `text`: The rendered text content

### Image Chunk

```json
{
  "type": "image",
  "id": "uuid-string",
  "chunk_index": 1,
  "image_data": {
    "base64_data": "iVBORw0KGg...",
    "format": "PNG",
    "width": 100,
    "height": 200,
    "mode": "RGB"
  }
}
```

**Fields**:
- `type`: Always `"image"` for image chunks
- `id`: Unique UUID for this chunk
- `chunk_index`: Position in the chunks array (0-indexed)
- `image_data`: Serialized image with:
  - `base64_data`: Base64-encoded image bytes
  - `format`: Image format (PNG, JPEG, etc.)
  - `width`: Image width in pixels
  - `height`: Image height in pixels
  - `mode`: Color mode (RGB, RGBA, L, etc.)

### Notes

- Currently, text-only prompts render to a single text chunk at index 0
- Future versions may support multi-modal output with multiple chunks
- Images cannot be rendered to text; attempting to render a prompt with images raises `ImageRenderError`

## Chunk ID Lookup

The `chunk_id_to_index` mapping provides fast lookup from chunk UUID to array index.

```json
{
  "chunk-uuid-1": 0,
  "chunk-uuid-2": 1,
  "chunk-uuid-3": 2
}
```

**Usage**:
```python
# Given a chunk_id from a source span
chunk_id = span["chunk_id"]
chunk_index = data["chunk_id_to_index"][chunk_id]
chunk = data["chunks"][chunk_index]
```

## Source Map

The `source_map` array contains source spans that map positions in rendered chunks back to source elements.

### Source Span Structure

```json
{
  "start": 0,
  "end": 5,
  "key": "variable_name",
  "path": ["outer_key", "inner_key"],
  "element_type": "interpolation",
  "chunk_index": 0,
  "chunk_id": "chunk-uuid",
  "element_id": "element-uuid"
}
```

### Fields

- **`start`**: Starting position (inclusive) in the chunk
  - For text chunks: character offset (0-indexed)
  - For image chunks: always 0
- **`end`**: Ending position (exclusive) in the chunk
  - For text chunks: character offset
  - For image chunks: always 1
- **`key`**: Element key
  - String for interpolations (e.g., `"variable_name"`)
  - Integer for static segments (e.g., `0`, `1`, `2`)
- **`path`**: Array representing the path from root to this element
  - Empty array `[]` for root-level elements
  - Contains sequence of keys for nested elements (e.g., `["outer", "inner"]`)
- **`element_type`**: Type of source element
  - `"static"`: Literal text between interpolations
  - `"interpolation"`: Variable interpolation
  - `"image"`: Image interpolation (future support)
- **`chunk_index`**: Index of the chunk this span refers to
- **`chunk_id`**: UUID of the chunk (for bidirectional lookup)
- **`element_id`**: UUID of the source element (from `source_prompt`)

### Bidirectional Mapping

The source map enables efficient queries in both directions:

**Source → Output**: Given `element_id`, find all chunks and positions where it appears
```python
# Find all spans for a specific element
element_id = "element-uuid"
spans = [s for s in data["source_map"] if s["element_id"] == element_id]

# Get rendered text for each span
for span in spans:
    chunk = data["chunks"][span["chunk_index"]]
    if chunk["type"] == "text":
        rendered_text = chunk["text"][span["start"]:span["end"]]
```

**Output → Source**: Given `chunk_id` and position, find which element produced it
```python
# Find element at specific position
chunk_id = "chunk-uuid"
position = 10

# Find span containing this position
span = next(
    s for s in data["source_map"]
    if s["chunk_id"] == chunk_id and s["start"] <= position < s["end"]
)

# Get source element
element_id = span["element_id"]
```

## Query Patterns

### 1. Find All Text Produced by an Element

```python
def get_rendered_text_for_element(data, element_id):
    """Get all rendered text for a specific source element."""
    results = []
    for span in data["source_map"]:
        if span["element_id"] == element_id:
            chunk = data["chunks"][span["chunk_index"]]
            if chunk["type"] == "text":
                text = chunk["text"][span["start"]:span["end"]]
                results.append({
                    "text": text,
                    "chunk_index": span["chunk_index"],
                    "start": span["start"],
                    "end": span["end"],
                })
    return results
```

### 2. Find Source Element at Position

```python
def get_source_at_position(data, chunk_index, position):
    """Find which source element produced text at a position."""
    for span in data["source_map"]:
        if span["chunk_index"] == chunk_index and span["start"] <= position < span["end"]:
            return {
                "element_id": span["element_id"],
                "element_type": span["element_type"],
                "key": span["key"],
                "path": span["path"],
            }
    return None
```

### 3. Find All Interpolations by Key

```python
def get_interpolations_by_key(data, key):
    """Find all interpolations with a specific key."""
    results = []
    for span in data["source_map"]:
        if span["element_type"] == "interpolation" and span["key"] == key:
            chunk = data["chunks"][span["chunk_index"]]
            if chunk["type"] == "text":
                text = chunk["text"][span["start"]:span["end"]]
                results.append({
                    "text": text,
                    "path": span["path"],
                    "element_id": span["element_id"],
                })
    return results
```

### 4. Navigate from Chunk to Source Element

```python
def get_element_from_source_prompt(data, element_id):
    """Find element in source_prompt tree by ID."""
    def search_children(children):
        for child in children:
            if child["id"] == element_id:
                return child

            # Recurse into nested children
            if "children" in child:
                if isinstance(child["children"], list):
                    # Could be regular children or list items
                    if child["children"] and "prompt_id" in child["children"][0]:
                        # List items
                        for item in child["children"]:
                            result = search_children(item["children"])
                            if result:
                                return result
                    else:
                        # Regular children
                        result = search_children(child["children"])
                        if result:
                            return result
        return None

    return search_children(data["source_prompt"]["children"])
```

### 5. Count Tokens by Element Type

```python
def count_tokens_by_type(data):
    """Count rendered text length by element type."""
    counts = {"static": 0, "interpolation": 0, "image": 0}

    for span in data["source_map"]:
        chunk = data["chunks"][span["chunk_index"]]
        if chunk["type"] == "text":
            length = span["end"] - span["start"]
            counts[span["element_type"]] += length

    return counts
```

### 6. Extract All Static Text

```python
def get_all_static_text(data):
    """Extract all static (literal) text segments."""
    results = []
    for span in data["source_map"]:
        if span["element_type"] == "static":
            chunk = data["chunks"][span["chunk_index"]]
            if chunk["type"] == "text":
                text = chunk["text"][span["start"]:span["end"]]
                results.append({
                    "text": text,
                    "key": span["key"],
                    "path": span["path"],
                })
    return results
```

### 7. Find Nested Interpolations

```python
def get_nested_interpolations(data):
    """Find all interpolations that are nested (non-root path)."""
    results = []
    for span in data["source_map"]:
        if span["element_type"] == "interpolation" and len(span["path"]) > 0:
            chunk = data["chunks"][span["chunk_index"]]
            if chunk["type"] == "text":
                text = chunk["text"][span["start"]:span["end"]]
                results.append({
                    "text": text,
                    "key": span["key"],
                    "path": span["path"],
                    "element_id": span["element_id"],
                })
    return results
```

### 8. Correlate Rendered Output with Source

```python
def correlate_output_with_source(data):
    """Create a detailed mapping showing how output maps to source."""
    correlation = []

    for chunk in data["chunks"]:
        chunk_id = chunk["id"]
        chunk_index = chunk["chunk_index"]

        # Find all spans in this chunk
        spans = [s for s in data["source_map"] if s["chunk_index"] == chunk_index]
        spans.sort(key=lambda s: s["start"])  # Sort by position

        for span in spans:
            # Get source element
            element = get_element_from_source_prompt(data, span["element_id"])

            if chunk["type"] == "text":
                rendered_text = chunk["text"][span["start"]:span["end"]]
                correlation.append({
                    "chunk_index": chunk_index,
                    "position": f"{span['start']}-{span['end']}",
                    "rendered": rendered_text,
                    "element_type": span["element_type"],
                    "element_key": span["key"],
                    "element_path": span["path"],
                    "source_element": element,
                })

    return correlation
```

## Use Cases

### Debugging Complex Prompts

Use the bidirectional mapping to understand which source elements produced specific output:

```python
# Load IR JSON
ir = prompt.render()
data = ir.toJSON()

# Find what produced character 42 in the output
source = get_source_at_position(data, chunk_index=0, position=42)
print(f"Position 42 came from {source['element_type']} '{source['key']}'")

# Get the full source element
element = get_element_from_source_prompt(data, source["element_id"])
print(f"Source: {element}")
```

### Optimization and Token Counting

Analyze prompt structure to identify optimization opportunities:

```python
# Count tokens by element type
counts = count_tokens_by_type(data)
print(f"Static text: {counts['static']} chars")
print(f"Interpolations: {counts['interpolation']} chars")

# Find longest interpolations
interp_lengths = []
for span in data["source_map"]:
    if span["element_type"] == "interpolation":
        length = span["end"] - span["start"]
        interp_lengths.append((span["key"], length))

# Sort by length and show top 10
top_interps = sorted(interp_lengths, key=lambda x: x[1], reverse=True)[:10]
print("Longest interpolations:", top_interps)
```

### Provenance Tracking

Track the origin of every piece of rendered output:

```python
# Get complete provenance for output
correlation = correlate_output_with_source(data)

# Show first 5 mappings
for item in correlation[:5]:
    print(f"[{item['position']}] {item['rendered']!r}")
    print(f"  From: {item['element_type']} '{item['element_key']}'")
    print(f"  Path: {item['element_path']}")
```

### Audit Logging

Log which code paths generated specific prompts:

```python
# Extract all interpolations with source locations
def log_interpolation_sources(data):
    for span in data["source_map"]:
        if span["element_type"] == "interpolation":
            element = get_element_from_source_prompt(data, span["element_id"])
            source_loc = element.get("source_location")

            if source_loc and source_loc.get("filename"):
                print(f"Interpolation '{span['key']}' from {source_loc['filename']}:{source_loc['line']}")
```

### Source Map Validation

Verify source map integrity:

```python
def validate_source_map(data):
    """Validate that source map is complete and consistent."""
    # Check all spans reference valid chunks
    for span in data["source_map"]:
        chunk_index = span["chunk_index"]
        chunk_id = span["chunk_id"]

        # Verify chunk exists
        assert chunk_index < len(data["chunks"]), f"Invalid chunk_index: {chunk_index}"

        # Verify chunk_id matches
        chunk = data["chunks"][chunk_index]
        assert chunk["id"] == chunk_id, f"Chunk ID mismatch at index {chunk_index}"

        # Verify positions are valid
        if chunk["type"] == "text":
            assert 0 <= span["start"] < span["end"] <= len(chunk["text"])

    print("Source map validation passed!")
```

## Language-Agnostic Pseudocode

Here's pseudocode for common operations:

```
// Find all text for an element
function get_text_for_element(data, element_id):
    results = []
    for span in data.source_map:
        if span.element_id == element_id:
            chunk = data.chunks[span.chunk_index]
            if chunk.type == "text":
                text = chunk.text.substring(span.start, span.end)
                results.append(text)
    return results

// Find source at position
function find_source_at_position(data, chunk_index, position):
    for span in data.source_map:
        if span.chunk_index == chunk_index:
            if span.start <= position < span.end:
                return {
                    element_id: span.element_id,
                    element_type: span.element_type,
                    key: span.key,
                    path: span.path
                }
    return null

// Walk all spans
function walk_spans(data, callback):
    for span in data.source_map:
        chunk = data.chunks[span.chunk_index]
        callback(span, chunk)
```

## Performance Considerations

### Lookup Complexity

- **Chunk lookup by ID**: O(1) using `chunk_id_to_index`
- **Element lookup by ID**: O(n) requires tree traversal of `source_prompt`
- **Position lookup**: O(n) requires linear scan of `source_map`
- **Key lookup**: O(n) requires linear scan of `source_map`

### Optimization Strategies

**Build reverse indices** for frequent queries:

```python
# Build element_id → spans index
element_to_spans = {}
for span in data["source_map"]:
    element_id = span["element_id"]
    if element_id not in element_to_spans:
        element_to_spans[element_id] = []
    element_to_spans[element_id].append(span)

# Build position index for fast lookup
position_index = {}
for span in data["source_map"]:
    chunk_id = span["chunk_id"]
    if chunk_id not in position_index:
        position_index[chunk_id] = []
    position_index[chunk_id].append(span)

# Sort each chunk's spans by position
for chunk_id in position_index:
    position_index[chunk_id].sort(key=lambda s: s["start"])
```

**Cache source_prompt tree lookups**:

```python
# Build element ID → element mapping
element_cache = {}

def build_element_cache(children):
    for child in children:
        element_cache[child["id"]] = child
        if "children" in child:
            # Handle nested children
            if isinstance(child["children"], list):
                if child["children"] and "prompt_id" in child["children"][0]:
                    for item in child["children"]:
                        build_element_cache(item["children"])
                else:
                    build_element_cache(child["children"])

build_element_cache(data["source_prompt"]["children"])

# Now lookups are O(1)
element = element_cache[element_id]
```

## Comparison with StructuredPrompt.toJSON()

The IR `toJSON()` extends the StructuredPrompt format with:

1. **Rendered Output**: Includes actual chunks of rendered text/images
2. **Bidirectional Mapping**: Source map connects source elements to output positions
3. **Chunk Metadata**: Each chunk has UUID, index, and type information
4. **Fast Lookup**: `chunk_id_to_index` enables O(1) chunk access

The StructuredPrompt is embedded as `source_prompt` using its hierarchical tree structure.

## Next Steps

- See [toJSON Format](to-json-format.md) for StructuredPrompt.toJSON() reference
- Check [Features documentation](../features.md) for usage examples
- Read [Architecture documentation](../Architecture.md) for system design
- Explore [API Reference](../reference.md) for complete API
