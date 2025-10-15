# JSON Format Reference

This document describes the JSON structures for the three main objects in structured-prompts:
1. **StructuredPrompt** - the source prompt structure
2. **IntermediateRepresentation (IR)** - rendered chunks with metadata
3. **CompiledIR** - optimized index for querying subtrees

## StructuredPrompt JSON

The `StructuredPrompt.toJSON()` method exports a hierarchical tree structure with explicit children arrays.

### Structure

```javascript
{
  prompt_id: "uuid-string",      // UUID of the root StructuredPrompt
  children: [                     // Array of child elements
    {
      type: "static",             // Element type
      id: "uuid-1",               // Element UUID
      parent_id: "root-uuid",     // Parent element UUID
      key: 0,                     // Integer index for statics, string for interpolations
      index: 0,                   // Position in element sequence
      value: "literal text",      // For static elements
      source_location: {          // Or null if unavailable
        filename: "script.py",
        filepath: "/path/to/script.py",
        line: 42
      }
    },
    {
      type: "interpolation",      // Simple string interpolation
      id: "uuid-2",
      parent_id: "root-uuid",
      key: "variable_name",
      index: 1,
      expression: "variable_name",
      conversion: "r",            // "r", "s", "a", or null
      format_spec: "variable_name",
      render_hints: "",
      value: "interpolated value",
      source_location: {...}
    },
    {
      type: "nested_prompt",      // Nested StructuredPrompt
      id: "uuid-3",
      parent_id: "root-uuid",
      key: "nested",
      index: 2,
      expression: "nested_var",
      conversion: null,
      format_spec: "nested",
      render_hints: "",
      prompt_id: "nested-uuid",   // UUID of the nested prompt
      children: [                 // Nested prompt's elements
        {...},
        ...
      ],
      source_location: {...}
    },
    {
      type: "list",               // List of StructuredPrompts
      id: "uuid-4",
      parent_id: "root-uuid",
      key: "items",
      index: 3,
      expression: "items_var",
      conversion: null,
      format_spec: "items:sep=, ",
      render_hints: "sep=, ",
      separator: ", ",            // Parsed separator (default: "\n")
      children: [                 // Array of list items
        {
          prompt_id: "item-uuid-1",
          children: [...]         // First item's elements
        },
        {
          prompt_id: "item-uuid-2",
          children: [...]         // Second item's elements
        }
      ],
      source_location: {...}
    },
    {
      type: "image",              // PIL Image object
      id: "uuid-5",
      parent_id: "root-uuid",
      key: "img",
      index: 4,
      expression: "img",
      conversion: null,
      format_spec: "img",
      render_hints: "",
      image_data: {               // Base64-encoded image
        base64_data: "iVBORw0KGg...",
        format: "PNG",
        width: 100,
        height: 200,
        mode: "RGB"
      },
      source_location: {...}
    }
  ]
}
```

### Element Types

- **static**: Literal text between interpolations
- **interpolation**: Simple string variable (not a nested prompt)
- **nested_prompt**: A StructuredPrompt interpolated into another prompt
- **list**: A list of StructuredPrompts
- **image**: A PIL Image object

### Navigating the Tree

**Walk all elements recursively:**

```javascript
function walkTree(children, callback, depth = 0) {
  for (const element of children) {
    callback(element, depth);

    if (element.children) {
      if (element.type === "list") {
        // List items: each has {prompt_id, children}
        for (const item of element.children) {
          walkTree(item.children, callback, depth + 1);
        }
      } else {
        // Regular nested children
        walkTree(element.children, callback, depth + 1);
      }
    }
  }
}

// Example: print all interpolations
const data = structuredPrompt.toJSON();
walkTree(data.children, (elem, depth) => {
  if (elem.type === "interpolation") {
    console.log(`${"  ".repeat(depth)}${elem.key}: ${elem.value}`);
  }
});
```

**Find element by ID:**

```javascript
function findElementById(children, targetId) {
  for (const elem of children) {
    if (elem.id === targetId) return elem;

    if (elem.children) {
      if (elem.type === "list") {
        for (const item of elem.children) {
          const result = findElementById(item.children, targetId);
          if (result) return result;
        }
      } else {
        const result = findElementById(elem.children, targetId);
        if (result) return result;
      }
    }
  }
  return null;
}
```

**Get parent element:**

```javascript
function getParent(data, element) {
  const parentId = element.parent_id;

  // Check if parent is root
  if (parentId === data.prompt_id) return null;

  // Find parent in tree
  return findElementById(data.children, parentId);
}
```

## IntermediateRepresentation JSON

The `IntermediateRepresentation.toJSON()` method exports rendered chunks with metadata and source prompt reference.

### Structure

```javascript
{
  chunks: [                       // Array of rendered chunks
    {
      type: "TextChunk",
      text: "rendered text",
      element_id: "element-uuid", // UUID of source element
      id: "chunk-uuid",
      metadata: {}                // Optional metadata
    },
    {
      type: "ImageChunk",
      image: {                    // Serialized image
        base64_data: "iVBORw0KGg...",
        format: "PNG",
        width: 100,
        height: 200,
        mode: "RGB"
      },
      element_id: "element-uuid",
      id: "chunk-uuid",
      metadata: {}
    }
  ],
  source_prompt_id: "prompt-uuid", // UUID of source StructuredPrompt (or null)
  id: "ir-uuid",                   // UUID of this IR
  metadata: {}                     // Optional metadata
}
```

### Working with Chunks

**Get all text from IR:**

```javascript
const ir = structuredPrompt.ir();
const data = ir.toJSON();

// Concatenate all text chunks
const fullText = data.chunks
  .filter(chunk => chunk.type === "TextChunk")
  .map(chunk => chunk.text)
  .join("");
```

**Find chunks by element:**

```javascript
function getChunksForElement(data, elementId) {
  return data.chunks.filter(chunk => chunk.element_id === elementId);
}

// Example: get all chunks produced by a specific element
const chunks = getChunksForElement(data, "element-uuid");
chunks.forEach(chunk => {
  if (chunk.type === "TextChunk") {
    console.log(chunk.text);
  }
});
```

**Map chunks to source elements:**

```javascript
// Build a map: element_id -> chunks
const chunksByElement = {};
for (const chunk of data.chunks) {
  if (!chunksByElement[chunk.element_id]) {
    chunksByElement[chunk.element_id] = [];
  }
  chunksByElement[chunk.element_id].push(chunk);
}
```

## CompiledIR JSON

The `CompiledIR.toJSON()` method exports an optimized index for querying element subtrees.

### Structure

```javascript
{
  ir_id: "ir-uuid",               // UUID of the source IR
  subtree_map: {                  // element_id -> list of chunk_ids in subtree
    "element-uuid-1": ["chunk-1", "chunk-2"],
    "element-uuid-2": ["chunk-3"],
    "prompt-uuid": ["chunk-1", "chunk-2", "chunk-3"]  // All chunks for prompt
  },
  num_elements: 10                // Total number of elements indexed
}
```

### Using the Subtree Map

The `subtree_map` enables efficient queries for all chunks produced by an element and its descendants.

**Get all chunks for an element subtree:**

```javascript
// Given compiled IR data and IR data
const compiledData = compiledIr.toJSON();
const irData = ir.toJSON();

function getChunksForSubtree(compiledData, irData, elementId) {
  const chunkIds = compiledData.subtree_map[elementId] || [];

  // Build chunk lookup
  const chunkLookup = {};
  for (const chunk of irData.chunks) {
    chunkLookup[chunk.id] = chunk;
  }

  // Return chunks in order
  return chunkIds.map(id => chunkLookup[id]);
}

// Example: get all chunks for a nested prompt element
const chunks = getChunksForSubtree(compiledData, irData, "nested-prompt-uuid");
const text = chunks
  .filter(c => c.type === "TextChunk")
  .map(c => c.text)
  .join("");
```

**Count chunks by subtree:**

```javascript
function countChunksBySubtree(compiledData) {
  const counts = {};
  for (const [elementId, chunkIds] of Object.entries(compiledData.subtree_map)) {
    counts[elementId] = chunkIds.length;
  }
  return counts;
}
```

## Complete Example: All Three Together

This example shows how to work with all three JSON structures together.

```javascript
// 1. Get StructuredPrompt structure
const promptData = structuredPrompt.toJSON();

// 2. Render to IR and get chunks
const ir = structuredPrompt.ir();
const irData = ir.toJSON();

// 3. Compile IR for efficient queries
const compiled = ir.compile();
const compiledData = compiled.toJSON();

// Now we can:
// - Navigate the source structure (promptData)
// - Access rendered chunks (irData)
// - Query element subtrees efficiently (compiledData)

// Example: Find an interpolation and get its rendered text
walkTree(promptData.children, (elem) => {
  if (elem.type === "interpolation" && elem.key === "user_name") {
    // Get all chunks this element produced
    const chunks = getChunksForSubtree(compiledData, irData, elem.id);
    const renderedText = chunks
      .filter(c => c.type === "TextChunk")
      .map(c => c.text)
      .join("");

    console.log(`Interpolation '${elem.key}' rendered as: ${renderedText}`);
    console.log(`Original value was: ${elem.value}`);
  }
});
```

## Use Cases

### StructuredPrompt JSON
- Navigate prompt structure without Python
- Analyze prompt composition
- Extract metadata and source locations
- Build external analysis tools

### IntermediateRepresentation JSON
- Access rendered output chunks
- Map rendered text back to source elements
- Store rendered prompts with provenance
- Multi-modal output handling (text + images)

### CompiledIR JSON
- Efficient subtree queries (which chunks came from element X?)
- Optimization analysis (token counting by element)
- Interactive debugging (hover over element, show its output)
- Performance-critical applications

## Widget Visualization

The widget renderer uses a combined JSON structure with all three objects:

```javascript
{
  source_prompt: {...},   // StructuredPrompt.toJSON()
  ir: {...},              // IntermediateRepresentation.toJSON()
  compiled_ir: {...}      // CompiledIR.toJSON()
}
```

This combined structure enables the widget to:
- Display the prompt structure with syntax highlighting
- Show rendered output chunks
- Highlight which chunks correspond to which elements
- Provide interactive exploration of the prompt tree
