# Phase II: Widget Rendering Architecture

## Executive Summary

Phase II implements a sophisticated bidirectional mapping system that connects three representations of structured prompts:

1. **Code View DOM** - Nested spans showing source-like text with Markdown syntax visible
2. **Markdown String** - The text that gets parsed by markdown-it
3. **Preview DOM** - The rendered Markdown HTML output

This infrastructure enables future interactive features (hover synchronization, click navigation, selection mirroring) while properly supporting all structured prompt features including XML wrappers, Markdown headers, lists, nested prompts, and images.

## Architecture Decisions

### Decision 1: Data Source

**Choice:** Use IntermediateRepresentation (IR) from `ir.toJSON()`

**Rationale:**
- IR contains `source_prompt` field with complete StructuredPrompt hierarchy (superset of `prompt.toJSON()`)
- IR includes `chunks` array with rendered output
- IR has `source_map` with bidirectional element-to-chunk mapping
- Provides richer information for advanced features

**Data structure:**
```json
{
  "ir_id": "uuid",
  "source_prompt": {
    "prompt_id": "uuid",
    "children": [...]
  },
  "chunks": [...],
  "chunk_id_to_index": {...},
  "source_map": [...]
}
```

### Decision 2: Image Rendering

**Choice:** Inline thumbnails in code view

**Rationale:**
- Shows actual image data inline (like modern code editors)
- Reasonable max size (200x200px) for readability
- Maintains visual flow of the "code"
- Images are first-class citizens in structured prompts

**Implementation:**
```html
<img
  data-element-id="elem-7"
  data-type="image"
  src="data:image/png;base64,..."
  style="max-width: 200px; max-height: 200px;"
  class="tp-code-image">
```

### Decision 3: Performance Optimization

**Choice:** No optimization for Phase II

**Rationale:**
- Keep implementation simple and correct first
- Most prompts will be <1000 elements
- Can add virtualization/lazy rendering in Phase III if needed
- Premature optimization is the root of all evil

### Decision 4: Markdown Source Mapping

**Choice:** Use markdown-it's built-in token system with custom renderer rules

**Rationale:**
- Tokens already have `.map` property with line numbers
- Can track character positions by traversing token stream
- `markdown-it-source-map` plugin is 9 years old, only tracks lines
- Full control over mapping granularity
- No unmaintained dependencies
- Fits naturally with our custom mapping approach

**Implementation approach:**
```typescript
md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const [startLine, endLine] = token.map || [0, 0];
  token.attrSet('data-source-line', startLine.toString());
  return self.renderToken(tokens, idx, options);
};
```

### Decision 5: DOM Construction Method

**Choice:** Plain DOM API with simple helper functions

**Rationale:**
- Code view is mostly static once built (not reactive)
- Need precise control to track each element during construction
- Preact/JSX is overkill for non-reactive, one-time DOM building
- No extra dependencies or build transforms needed
- TypeScript gives full type safety with built-in DOM API
- Simple helpers provide ergonomics without magic

**Helper example:**
```typescript
function createSpan(
  attrs: Record<string, string>,
  ...children: (HTMLElement | string)[]
): HTMLElement {
  const span = document.createElement('span');
  Object.entries(attrs).forEach(([k, v]) => span.setAttribute(k, v));
  children.forEach(child => {
    span.appendChild(
      typeof child === 'string'
        ? document.createTextNode(child)
        : child
    );
  });
  return span;
}
```

## Core Problems

### Problem 1: Nested Span Structure

**Current state:**
- Widget generates flat HTML strings via concatenation
- No element tracking
- No way to identify which span corresponds to which JSON element

**Required state:**
- Each element from JSON structure gets its own span with `data-element-id`
- Nested elements create nested DOM structure
- All element types properly wrapped (static, interpolation, nested, list, image)
- Render hints (headers, XML) visible as text but structurally tracked

**Example transformation:**

Before (flat string):
```typescript
html += '<span>Task: </span><span>Analyze the code</span>';
```

After (structured DOM):
```typescript
const taskStatic = createSpan({
  'data-element-id': 'elem-1',
  'data-type': 'static'
}, 'Task: ');

const taskInterp = createSpan({
  'data-element-id': 'elem-2',
  'data-type': 'interpolation',
  'data-key': 'task'
}, 'Analyze the code');

container.appendChild(taskStatic);
container.appendChild(taskInterp);
```

### Problem 2: Bidirectional Mapping

**The mapping challenge:**

We need to connect three representations:
```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Code View DOM  │ ←─────→ │ Markdown String  │ ←─────→ │  Preview DOM    │
│                 │         │                  │         │                 │
│ <span           │         │ "# Task\n        │         │ <h1>Task</h1>   │
│   id="elem-1">  │         │ Analyze..."      │         │ <p>Analyze...</p>│
│   # Task        │         │                  │         │                 │
│ </span>         │         │ positions:       │         │ positions:      │
│                 │         │ elem-1: [0, 7]   │         │ h1: [0, 7]      │
│ <span           │         │ elem-2: [8, 23]  │         │ p: [8, 23]      │
│   id="elem-2">  │         │                  │         │                 │
│   Analyze...    │         │                  │         │                 │
│ </span>         │         │                  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

**Three mapping layers:**

1. **Code View → String Positions:**
   - `Map<elementId, {start, end, spanElement}>`
   - Built during parallel construction
   - Answers: "What string range does this code span represent?"

2. **String Positions → Preview DOM:**
   - `Map<HTMLElement, {sourceStart, sourceEnd}>`
   - Built during markdown rendering
   - Answers: "What preview element came from this string range?"

3. **Combined Bidirectional Lookup:**
   - Given code span → find corresponding preview elements
   - Given preview element → find corresponding code spans
   - Essential for future interactivity

### Problem 3: Render Hints (Missing Features)

**Current state:**
- Widget ignores `render_hints` field in JSON
- Headers and XML wrappers not rendered
- Output doesn't match Python `str(prompt)`

**Required state:**

Render hints affect both string generation and DOM structure:

**Header hint (`header=Text` or `header`):**
```typescript
// Before content:
const headerSpan = createSpan({
  'data-element-id': `${elementId}-header`,
  'data-type': 'render-hint-header',
  'data-parent-id': elementId
}, `${'#'.repeat(level)} ${headerText}\n`);

string.append(`${elementId}-header`, headerText);
```

**XML hint (`xml=tag`):**
```typescript
// Before content:
const openTag = `<${tag}>\n`;
const openSpan = createSpan({
  'data-element-id': `${elementId}-xml-open`,
  'data-type': 'render-hint-xml-open'
}, openTag);

// After content:
const closeTag = `\n</${tag}>`;
const closeSpan = createSpan({
  'data-element-id': `${elementId}-xml-close`,
  'data-type': 'render-hint-xml-close'
}, closeTag);
```

**Ordering (critical):** Header outer, XML inner (matches Python)

```
# Task          <- Header (outer)
<thinking>      <- XML open (inner)
Content here
</thinking>     <- XML close (inner)
```

**Header level nesting:**
```python
# Level 1         <- currentHeaderLevel = 1
## Level 2        <- currentHeaderLevel = 2 (nested prompt with header)
### Level 3       <- currentHeaderLevel = 3 (nested again)
#### Level 4      <- max level reached, stays at 4
```

### Problem 4: Python Consistency

**Requirement:** JavaScript rendering must match Python's `render()` exactly

**Key behaviors to replicate:**

1. **Header level tracking:**
   - Start at level 1
   - Increment when entering nested prompt with `header` hint
   - Cap at `max_header_level` (default 4)

2. **XML wrapper ordering:**
   - Headers always outside XML
   - XML wraps the content

3. **List separator handling:**
   - Parse `sep=` from render hints
   - Default separator is `\n`
   - Apply base indentation after separator (if preceding static has trailing whitespace)

4. **Source map span adjustments:**
   - When headers/XML add prefix, adjust span positions
   - Track offset for nested elements

**Testing strategy:**
```python
# Python
ir = prompt.render()
python_string = ir.text

# JavaScript
js_string = generateMarkdownString(ir.toJSON())

# Assert
assert python_string == js_string  # Must be identical
```

## Architecture Overview

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Phase 2 Data Flow                               │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │   IR JSON Input      │
                    │  (from Python)       │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Parse source_prompt │
                    │   Walk children[]    │
                    └──────────┬───────────┘
                               │
                   ┌───────────┴────────────┐
                   │                        │
                   ▼                        ▼
      ┌────────────────────────┐  ┌────────────────────────┐
      │  CodeViewBuilder       │  │  StringWithMapping     │
      │  - Create spans        │  │  - Build string        │
      │  - Track element IDs   │  │  - Track positions     │
      │  - Build DOM tree      │  │  - Same element IDs    │
      └────────────┬───────────┘  └────────────┬───────────┘
                   │                           │
                   │    ┌──────────────────────┤
                   │    │                      │
                   ▼    ▼                      ▼
      ┌────────────────────────┐  ┌────────────────────────┐
      │  Code View DOM         │  │  Markdown String       │
      │  (with element IDs)    │  │  (with positions)      │
      └────────────────────────┘  └────────────┬───────────┘
                                               │
                                               ▼
                                  ┌────────────────────────┐
                                  │  markdown-it           │
                                  │  + custom rules        │
                                  │  (track positions)     │
                                  └────────────┬───────────┘
                                               │
                                               ▼
                                  ┌────────────────────────┐
                                  │  Preview DOM           │
                                  │  (with source attrs)   │
                                  └────────────────────────┘

                    ┌──────────────────────────────────────┐
                    │   InteractivityMapper                │
                    │   - Combines all mappings            │
                    │   - Bidirectional lookup API         │
                    │   - Ready for Phase 3 interactivity  │
                    └──────────────────────────────────────┘
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Phase 2 Components                                │
└─────────────────────────────────────────────────────────────────────────┘

widgets/src/
│
├── dom-builder.ts                  [Phase 2A]
│   ├── createSpan()                 ← Helper for creating span elements
│   ├── createImage()                ← Helper for creating image elements
│   └── createDiv()                  ← Helper for creating div elements
│
├── code-view-builder.ts            [Phase 2A]
│   └── class CodeViewBuilder
│       ├── addElement()             ← Add element with ID tracking
│       ├── addStatic()              ← Add static text span
│       ├── addInterpolation()       ← Add interpolation span
│       ├── addNestedPrompt()        ← Add nested prompt container
│       ├── addList()                ← Add list container
│       ├── addImage()               ← Add image element
│       ├── getContainer()           ← Get root DOM element
│       └── getElementMap()          ← Get ID → element mapping
│
├── string-mapper.ts                [Phase 2B]
│   └── class StringWithMapping
│       ├── append()                 ← Append text, track position
│       ├── getText()                ← Get complete string
│       ├── getPositions()           ← Get ID → position mapping
│       └── getElementAtPosition()   ← Find element at string position
│
├── render-hints.ts                 [Phase 2C]
│   ├── parseRenderHints()           ← Parse "header=X:xml=Y" format
│   ├── applyHeaderHint()            ← Add header span + string
│   ├── applyXmlHint()               ← Add XML wrapper spans + string
│   └── trackHeaderLevel()           ← Track nesting level
│
├── markdown-mapper.ts              [Phase 2D]
│   ├── createMarkdownWithMapping()  ← Create markdown-it with custom rules
│   ├── enhanceRenderer()            ← Add source position tracking
│   ├── extractMappings()            ← Extract element → position mappings
│   └── interface MarkdownMapping    ← Mapping data structure
│
└── interactivity-mapper.ts        [Phase 2E]
    └── class InteractivityMapper
        ├── constructor()            ← Build combined mapping
        ├── getPreviewFromCodeSpan() ← Code span → preview elements
        ├── getCodeSpanFromPreview() ← Preview element → code spans
        ├── getElementIdFromPosition() ← String pos → element ID
        └── rangesOverlap()          ← Helper for range checking
```

## Implementation Phases

### Phase 2A: Structured Code View with Element IDs

**Goal:** Replace string concatenation with structured DOM construction

**Components:**
- `dom-builder.ts` - Helper functions
- `code-view-builder.ts` - CodeViewBuilder class

**Key changes:**

1. **Create DOM helper functions:**
```typescript
// dom-builder.ts
export function createSpan(
  attrs: Record<string, string>,
  ...children: (HTMLElement | string)[]
): HTMLElement {
  const span = document.createElement('span');
  Object.entries(attrs).forEach(([k, v]) => span.setAttribute(k, v));
  children.forEach(child => {
    span.appendChild(
      typeof child === 'string'
        ? document.createTextNode(child)
        : child
    );
  });
  return span;
}

export function createImage(
  attrs: Record<string, string>,
  src: string
): HTMLImageElement {
  const img = document.createElement('img');
  img.src = src;
  Object.entries(attrs).forEach(([k, v]) => img.setAttribute(k, v));
  return img;
}
```

2. **Create CodeViewBuilder class:**
```typescript
// code-view-builder.ts
export class CodeViewBuilder {
  private container: HTMLElement;
  private elementMap: Map<string, {
    element: HTMLElement;
    jsonNode: ElementData;
    type: string;
  }> = new Map();

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'tp-code-view';
  }

  addElement(
    id: string,
    type: string,
    jsonNode: ElementData,
    element: HTMLElement
  ): void {
    this.elementMap.set(id, { element, jsonNode, type });
    this.container.appendChild(element);
  }

  addStatic(id: string, jsonNode: ElementData, text: string): HTMLElement {
    const span = createSpan({
      'data-element-id': id,
      'data-type': 'static',
      'data-key': jsonNode.key?.toString() || ''
    }, text);
    this.addElement(id, 'static', jsonNode, span);
    return span;
  }

  addInterpolation(id: string, jsonNode: ElementData, value: string): HTMLElement {
    const span = createSpan({
      'data-element-id': id,
      'data-type': 'interpolation',
      'data-key': jsonNode.key?.toString() || '',
      'data-expression': jsonNode.expression || ''
    }, value);
    this.addElement(id, 'interpolation', jsonNode, span);
    return span;
  }

  addImage(id: string, jsonNode: ElementData, imageData: ImageData): HTMLElement {
    if (!imageData.base64_data) {
      // Error case
      const span = createSpan({
        'data-element-id': id,
        'data-type': 'image',
        'data-error': imageData.error || 'No image data'
      }, '[image error]');
      this.addElement(id, 'image', jsonNode, span);
      return span;
    }

    const src = `data:image/${(imageData.format || 'png').toLowerCase()};base64,${imageData.base64_data}`;
    const img = createImage({
      'data-element-id': id,
      'data-type': 'image',
      'data-key': jsonNode.key?.toString() || '',
      'class': 'tp-code-image',
      'alt': `Image: ${imageData.width}x${imageData.height}`,
      'title': `${imageData.width}x${imageData.height} ${imageData.format}`,
      'style': 'max-width: 200px; max-height: 200px; display: block; margin: 4px 0;'
    }, src);
    this.addElement(id, 'image', jsonNode, img);
    return img;
  }

  getContainer(): HTMLElement {
    return this.container;
  }

  getElementMap() {
    return this.elementMap;
  }
}
```

3. **Walk IR source_prompt and build DOM:**
```typescript
function buildCodeView(sourcePrompt: WidgetData): CodeViewBuilder {
  const builder = new CodeViewBuilder();
  let elementCounter = 0;

  function walkChildren(children: ElementData[], parentElement: HTMLElement) {
    for (const child of children) {
      const elementId = `elem-${elementCounter++}`;

      if (child.type === 'static') {
        builder.addStatic(elementId, child, child.value || '');
      } else if (child.type === 'interpolation') {
        builder.addInterpolation(elementId, child, child.value || '');
      } else if (child.type === 'image' && child.image_data) {
        builder.addImage(elementId, child, child.image_data);
      } else if (child.type === 'nested_prompt' && child.children) {
        // Create container for nested prompt
        const container = createSpan({
          'data-element-id': elementId,
          'data-type': 'nested_prompt',
          'data-key': child.key?.toString() || ''
        });
        parentElement.appendChild(container);
        // Recurse into children
        walkChildren(child.children, container);
      } else if (child.type === 'list' && child.children) {
        // Create container for list
        const container = createSpan({
          'data-element-id': elementId,
          'data-type': 'list',
          'data-key': child.key?.toString() || ''
        });
        parentElement.appendChild(container);
        // Render each list item
        for (const item of child.children) {
          if (item.children) {
            walkChildren(item.children, container);
          }
        }
      }
    }
  }

  const root = builder.getContainer();
  walkChildren(sourcePrompt.children || [], root);
  return builder;
}
```

**Testing:**
- Visual snapshot tests with Playwright
- Test each element type renders correctly
- Test nesting structure is correct
- Test image thumbnails appear

**Example output:**
```html
<div class="tp-code-view">
  <span data-element-id="elem-0" data-type="static" data-key="0">Task: </span>
  <span data-element-id="elem-1" data-type="interpolation" data-key="task" data-expression="task">
    Analyze the code
  </span>
  <span data-element-id="elem-2" data-type="static" data-key="2">\n\n</span>
  <span data-element-id="elem-3" data-type="nested_prompt" data-key="examples">
    <span data-element-id="elem-4" data-type="static" data-key="0">Example 1</span>
  </span>
  <img data-element-id="elem-5" data-type="image" data-key="img"
       class="tp-code-image" src="data:image/png;base64,..."
       style="max-width: 200px; max-height: 200px; display: block; margin: 4px 0;">
</div>
```

### Phase 2B: String Generation with Position Tracking

**Goal:** Build markdown string in parallel with DOM, tracking character positions

**Components:**
- `string-mapper.ts` - StringWithMapping class

**Key implementation:**

```typescript
// string-mapper.ts
export class StringWithMapping {
  private text: string = '';
  private positions: Map<string, { start: number; end: number }> = new Map();

  append(elementId: string, content: string): void {
    const start = this.text.length;
    this.text += content;
    const end = this.text.length;
    this.positions.set(elementId, { start, end });
  }

  getText(): string {
    return this.text;
  }

  getPositions(): Map<string, { start: number; end: number }> {
    return this.positions;
  }

  getElementAtPosition(pos: number): string | null {
    for (const [id, range] of this.positions.entries()) {
      if (pos >= range.start && pos < range.end) {
        return id;
      }
    }
    return null;
  }

  getRange(elementId: string): { start: number; end: number } | null {
    return this.positions.get(elementId) || null;
  }
}
```

**Parallel construction:**

```typescript
function buildCodeViewAndString(sourcePrompt: WidgetData): {
  codeView: CodeViewBuilder;
  string: StringWithMapping;
} {
  const codeView = new CodeViewBuilder();
  const string = new StringWithMapping();
  let elementCounter = 0;

  function walkChildren(children: ElementData[], parentElement: HTMLElement) {
    for (const child of children) {
      const elementId = `elem-${elementCounter++}`;

      if (child.type === 'static') {
        const text = child.value || '';
        codeView.addStatic(elementId, child, text);
        string.append(elementId, text);
      } else if (child.type === 'interpolation') {
        const value = child.value || '';
        codeView.addInterpolation(elementId, child, value);
        string.append(elementId, value);
      } else if (child.type === 'image') {
        // Images don't contribute to markdown string
        codeView.addImage(elementId, child, child.image_data!);
        // No string.append for images
      }
      // ... handle nested_prompt, list ...
    }
  }

  const root = codeView.getContainer();
  walkChildren(sourcePrompt.children || [], root);

  return { codeView, string };
}
```

**Testing:**
- Unit tests verifying position ranges
- Test: `string.getElementAtPosition(5)` returns correct element ID
- Test: position ranges don't overlap incorrectly
- Test: empty strings handled correctly
- Test: images don't appear in string

**Example positions:**
```
String: "Task: Analyze the code\n\nExample 1"
Positions:
  elem-0: [0, 6]      -> "Task: "
  elem-1: [6, 23]     -> "Analyze the code"
  elem-2: [23, 25]    -> "\n\n"
  elem-4: [25, 34]    -> "Example 1"
```

### Phase 2C: Render Hints Support

**Goal:** Implement header and XML render hints

**Components:**
- `render-hints.ts` - Parse and apply render hints

**Implementation:**

```typescript
// render-hints.ts
export interface ParsedRenderHints {
  xml?: string;
  header?: string;
  sep?: string;
}

export function parseRenderHints(renderHints: string, key: string): ParsedRenderHints {
  if (!renderHints) return {};

  const result: ParsedRenderHints = {};

  // Split on colon and process each hint
  for (const hint of renderHints.split(':')) {
    const trimmed = hint.trim();

    if (trimmed.startsWith('xml=')) {
      const xmlValue = trimmed.substring(4).trim();
      if (/\s/.test(xmlValue)) {
        throw new Error(`XML tag name cannot contain whitespace: ${xmlValue}`);
      }
      result.xml = xmlValue;
    } else if (trimmed.startsWith('header=')) {
      result.header = trimmed.substring(7).trim();
    } else if (trimmed === 'header') {
      result.header = key; // Use key as heading
    } else if (trimmed.startsWith('sep=')) {
      result.sep = trimmed.substring(4); // Don't trim separator value
    }
  }

  return result;
}

export function applyHeaderHint(
  codeView: CodeViewBuilder,
  string: StringWithMapping,
  parentElementId: string,
  headerText: string,
  level: number
): string {
  const headerId = `${parentElementId}-header`;
  const headerContent = '#'.repeat(level) + ' ' + headerText + '\n';

  // Add to code view
  const headerSpan = createSpan({
    'data-element-id': headerId,
    'data-type': 'render-hint-header',
    'data-parent-id': parentElementId,
    'data-level': level.toString()
  }, headerContent);
  codeView.getContainer().appendChild(headerSpan);

  // Add to string
  string.append(headerId, headerContent);

  return headerId;
}

export function applyXmlHint(
  codeView: CodeViewBuilder,
  string: StringWithMapping,
  parentElementId: string,
  xmlTag: string,
  position: 'open' | 'close'
): string {
  const xmlId = `${parentElementId}-xml-${position}`;
  const xmlContent = position === 'open'
    ? `<${xmlTag}>\n`
    : `\n</${xmlTag}>`;

  // Add to code view
  const xmlSpan = createSpan({
    'data-element-id': xmlId,
    'data-type': `render-hint-xml-${position}`,
    'data-parent-id': parentElementId,
    'data-xml-tag': xmlTag
  }, xmlContent);
  codeView.getContainer().appendChild(xmlSpan);

  // Add to string
  string.append(xmlId, xmlContent);

  return xmlId;
}
```

**Integration into walkChildren:**

```typescript
function processElement(
  child: ElementData,
  elementId: string,
  currentHeaderLevel: number,
  maxHeaderLevel: number
) {
  // Parse render hints
  const hints = parseRenderHints(child.render_hints || '', child.key?.toString() || '');

  // Determine next header level
  let nextHeaderLevel = currentHeaderLevel;
  if (hints.header) {
    nextHeaderLevel = currentHeaderLevel + 1;
  }

  // Apply header hint (outer wrapper)
  if (hints.header) {
    const level = Math.min(currentHeaderLevel, maxHeaderLevel);
    applyHeaderHint(codeView, string, elementId, hints.header, level);
  }

  // Apply XML open tag (inner wrapper)
  if (hints.xml) {
    applyXmlHint(codeView, string, elementId, hints.xml, 'open');
  }

  // Render element content
  if (child.type === 'interpolation') {
    codeView.addInterpolation(elementId, child, child.value || '');
    string.append(elementId, child.value || '');
  } else if (child.type === 'nested_prompt') {
    // Recurse with updated header level
    walkChildren(child.children || [], parentElement, nextHeaderLevel, maxHeaderLevel);
  }
  // ... other types ...

  // Apply XML close tag (inner wrapper)
  if (hints.xml) {
    applyXmlHint(codeView, string, elementId, hints.xml, 'close');
  }
}
```

**Testing:**
- Visual tests with headers at different levels
- Visual tests with XML wrappers
- Visual tests with combined header + XML
- **Critical: Python consistency tests**
  - For each test case, compare JavaScript string output to Python `str(prompt)`
  - Must match exactly (including whitespace, newlines, etc.)
- Test header level capping at max
- Test header level nesting through multiple layers

**Example output:**

Input JSON:
```json
{
  "type": "interpolation",
  "key": "task",
  "value": "Analyze the code",
  "render_hints": "header=Task:xml=thinking"
}
```

Output DOM:
```html
<span data-element-id="elem-1-header" data-type="render-hint-header" data-level="1">
  # Task\n
</span>
<span data-element-id="elem-1-xml-open" data-type="render-hint-xml-open" data-xml-tag="thinking">
  <thinking>\n
</span>
<span data-element-id="elem-1" data-type="interpolation" data-key="task">
  Analyze the code
</span>
<span data-element-id="elem-1-xml-close" data-type="render-hint-xml-close" data-xml-tag="thinking">
  \n</thinking>
</span>
```

Output string:
```
# Task
<thinking>
Analyze the code
</thinking>
```

### Phase 2D: Markdown-it Integration with Source Mapping

**Goal:** Track which markdown output elements came from which input string positions

**Components:**
- `markdown-mapper.ts` - Custom markdown-it renderer with position tracking

**Implementation:**

```typescript
// markdown-mapper.ts
import MarkdownIt from 'markdown-it';

export interface MarkdownMapping {
  outputElement: HTMLElement;
  sourceStartLine: number;
  sourceEndLine: number;
  sourceStartChar: number;
  sourceEndChar: number;
}

export function createMarkdownWithMapping(md: MarkdownIt): {
  render: (markdown: string) => { html: string; mappings: MarkdownMapping[] };
} {
  const mappings: MarkdownMapping[] = [];

  // Store original rules
  const originalRules = { ...md.renderer.rules };

  // Helper to add source position attributes
  function addSourceAttrs(token: any): string {
    if (token.map) {
      const [startLine, endLine] = token.map;
      return ` data-source-line-start="${startLine}" data-source-line-end="${endLine}"`;
    }
    return '';
  }

  // Override heading_open
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const attrs = addSourceAttrs(token);
    const level = token.tag.slice(1); // 'h1' -> '1'
    return `<h${level}${attrs}>`;
  };

  // Override paragraph_open
  md.renderer.rules.paragraph_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const attrs = addSourceAttrs(token);
    return `<p${attrs}>`;
  };

  // Override list_item_open
  md.renderer.rules.list_item_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const attrs = addSourceAttrs(token);
    return `<li${attrs}>`;
  };

  // Override code_block
  md.renderer.rules.code_block = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const attrs = addSourceAttrs(token);
    return `<pre${attrs}><code>${escapeHtml(token.content)}</code></pre>\n`;
  };

  // ... override other rules as needed ...

  return {
    render: (markdown: string) => {
      const html = md.render(markdown);

      // Parse HTML to extract mappings
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Calculate character positions from line numbers
      const lines = markdown.split('\n');
      const lineToChar = [0]; // lineToChar[i] = character position where line i starts
      for (let i = 0; i < lines.length; i++) {
        lineToChar.push(lineToChar[i] + lines[i].length + 1); // +1 for \n
      }

      // Build mappings
      const extractedMappings: MarkdownMapping[] = [];
      const elementsWithSource = doc.querySelectorAll('[data-source-line-start]');

      elementsWithSource.forEach(element => {
        const startLine = parseInt(element.getAttribute('data-source-line-start') || '0');
        const endLine = parseInt(element.getAttribute('data-source-line-end') || '0');

        extractedMappings.push({
          outputElement: element as HTMLElement,
          sourceStartLine: startLine,
          sourceEndLine: endLine,
          sourceStartChar: lineToChar[startLine] || 0,
          sourceEndChar: lineToChar[endLine] || markdown.length
        });
      });

      return { html, mappings: extractedMappings };
    }
  };
}
```

**Testing:**
- Unit tests with simple markdown
- Test headers map correctly
- Test paragraphs map correctly
- Test lists map correctly
- Test character position calculation is accurate
- Test edge cases (empty lines, trailing newlines)

**Example:**

Input markdown:
```
# Task
Analyze the code

Example 1
```

Output HTML with mappings:
```html
<h1 data-source-line-start="0" data-source-line-end="1">Task</h1>
<p data-source-line-start="1" data-source-line-end="2">Analyze the code</p>
<p data-source-line-start="3" data-source-line-end="4">Example 1</p>
```

Mappings:
```typescript
[
  {
    outputElement: <h1>,
    sourceStartLine: 0,
    sourceEndLine: 1,
    sourceStartChar: 0,
    sourceEndChar: 7
  },
  {
    outputElement: <p>,
    sourceStartLine: 1,
    sourceEndLine: 2,
    sourceStartChar: 7,
    sourceEndChar: 24
  },
  {
    outputElement: <p>,
    sourceStartLine: 3,
    sourceEndLine: 4,
    sourceStartChar: 26,
    sourceEndChar: 35
  }
]
```

### Phase 2E: Bidirectional Lookup System

**Goal:** Connect all three representations with efficient lookup API

**Components:**
- `interactivity-mapper.ts` - InteractivityMapper class

**Implementation:**

```typescript
// interactivity-mapper.ts
import { CodeViewBuilder } from './code-view-builder';
import { StringWithMapping } from './string-mapper';
import { MarkdownMapping } from './markdown-mapper';

export class InteractivityMapper {
  // Element ID → Code view info
  private codeViewMap: Map<string, {
    span: HTMLElement;
    stringStart: number;
    stringEnd: number;
    jsonNode: any;
  }> = new Map();

  // Preview element → String position
  private previewMap: Map<HTMLElement, {
    sourceStartChar: number;
    sourceEndChar: number;
  }> = new Map();

  constructor(
    codeViewBuilder: CodeViewBuilder,
    stringMapper: StringWithMapping,
    markdownMappings: MarkdownMapping[]
  ) {
    this.buildCodeViewMap(codeViewBuilder, stringMapper);
    this.buildPreviewMap(markdownMappings);
  }

  private buildCodeViewMap(
    codeViewBuilder: CodeViewBuilder,
    stringMapper: StringWithMapping
  ): void {
    const elementMap = codeViewBuilder.getElementMap();
    const positions = stringMapper.getPositions();

    for (const [id, info] of elementMap.entries()) {
      const range = positions.get(id);
      if (range) {
        this.codeViewMap.set(id, {
          span: info.element,
          stringStart: range.start,
          stringEnd: range.end,
          jsonNode: info.jsonNode
        });
      }
    }
  }

  private buildPreviewMap(markdownMappings: MarkdownMapping[]): void {
    for (const mapping of markdownMappings) {
      this.previewMap.set(mapping.outputElement, {
        sourceStartChar: mapping.sourceStartChar,
        sourceEndChar: mapping.sourceEndChar
      });
    }
  }

  /**
   * Given a code view span, find corresponding preview elements
   */
  getPreviewFromCodeSpan(span: HTMLElement): HTMLElement[] {
    const elementId = span.getAttribute('data-element-id');
    if (!elementId) return [];

    const codeInfo = this.codeViewMap.get(elementId);
    if (!codeInfo) return [];

    // Find preview elements overlapping this string range
    const results: HTMLElement[] = [];
    for (const [element, range] of this.previewMap.entries()) {
      if (this.rangesOverlap(
        codeInfo.stringStart, codeInfo.stringEnd,
        range.sourceStartChar, range.sourceEndChar
      )) {
        results.push(element);
      }
    }
    return results;
  }

  /**
   * Given a preview element, find corresponding code spans
   */
  getCodeSpansFromPreview(element: HTMLElement): HTMLElement[] {
    const previewInfo = this.previewMap.get(element);
    if (!previewInfo) return [];

    // Find code spans overlapping this preview's source range
    const results: HTMLElement[] = [];
    for (const [id, info] of this.codeViewMap.entries()) {
      if (this.rangesOverlap(
        info.stringStart, info.stringEnd,
        previewInfo.sourceStartChar, previewInfo.sourceEndChar
      )) {
        results.push(info.span);
      }
    }
    return results;
  }

  /**
   * Given a string position, find the element ID
   */
  getElementIdFromPosition(stringPos: number): string | null {
    for (const [id, info] of this.codeViewMap.entries()) {
      if (stringPos >= info.stringStart && stringPos < info.stringEnd) {
        return id;
      }
    }
    return null;
  }

  /**
   * Get all code view spans
   */
  getAllCodeSpans(): HTMLElement[] {
    return Array.from(this.codeViewMap.values()).map(info => info.span);
  }

  /**
   * Get all preview elements
   */
  getAllPreviewElements(): HTMLElement[] {
    return Array.from(this.previewMap.keys());
  }

  /**
   * Check if two ranges overlap
   */
  private rangesOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number
  ): boolean {
    return start1 < end2 && start2 < end1;
  }

  /**
   * Debug: Get mapping info for element ID
   */
  debugGetCodeInfo(elementId: string) {
    return this.codeViewMap.get(elementId);
  }

  /**
   * Debug: Get mapping info for preview element
   */
  debugGetPreviewInfo(element: HTMLElement) {
    return this.previewMap.get(element);
  }
}
```

**Testing:**
- Integration tests with complete rendering pipeline
- Test: code span → preview → back to code span (should return original)
- Test: preview element → code span → back to preview (should return original)
- Test: overlapping ranges handled correctly
- Test: nested elements don't break mapping
- Test: edge cases (empty ranges, zero-length elements)
- Performance test: 1000+ elements lookup time

**Example usage:**

```typescript
// Build everything
const { codeView, string } = buildCodeViewAndString(ir.source_prompt);
const markdown = string.getText();
const { html, mappings } = markdownRenderer.render(markdown);

// Create mapper
const mapper = new InteractivityMapper(codeView, string, mappings);

// Look up preview from code
const codeSpan = document.querySelector('[data-element-id="elem-1"]');
const previewElements = mapper.getPreviewFromCodeSpan(codeSpan);
console.log('Code span maps to preview:', previewElements);

// Look up code from preview
const previewH1 = document.querySelector('h1');
const codeSpans = mapper.getCodeSpansFromPreview(previewH1);
console.log('Preview h1 maps to code spans:', codeSpans);
```

## Testing Strategy

### Level 1: Unit Tests

Each component has isolated unit tests:

**dom-builder.test.ts:**
```typescript
test('createSpan creates span with attributes', () => {
  const span = createSpan({ 'data-id': 'test' }, 'Hello');
  expect(span.tagName).toBe('SPAN');
  expect(span.getAttribute('data-id')).toBe('test');
  expect(span.textContent).toBe('Hello');
});
```

**code-view-builder.test.ts:**
```typescript
test('addStatic adds span to container', () => {
  const builder = new CodeViewBuilder();
  builder.addStatic('elem-1', { type: 'static', key: 0, value: 'Test' }, 'Test');

  const container = builder.getContainer();
  expect(container.children.length).toBe(1);
  expect(container.children[0].getAttribute('data-element-id')).toBe('elem-1');
});
```

**string-mapper.test.ts:**
```typescript
test('append tracks positions correctly', () => {
  const mapper = new StringWithMapping();
  mapper.append('elem-1', 'Hello');
  mapper.append('elem-2', ' World');

  expect(mapper.getText()).toBe('Hello World');
  expect(mapper.getRange('elem-1')).toEqual({ start: 0, end: 5 });
  expect(mapper.getRange('elem-2')).toEqual({ start: 5, end: 11 });
});

test('getElementAtPosition returns correct element', () => {
  const mapper = new StringWithMapping();
  mapper.append('elem-1', 'Hello');
  mapper.append('elem-2', ' World');

  expect(mapper.getElementAtPosition(0)).toBe('elem-1');
  expect(mapper.getElementAtPosition(4)).toBe('elem-1');
  expect(mapper.getElementAtPosition(5)).toBe('elem-2');
});
```

**render-hints.test.ts:**
```typescript
test('parseRenderHints extracts header and xml', () => {
  const hints = parseRenderHints('header=Task:xml=thinking', 'task');
  expect(hints).toEqual({
    header: 'Task',
    xml: 'thinking'
  });
});

test('parseRenderHints uses key when header has no value', () => {
  const hints = parseRenderHints('header:xml=data', 'mykey');
  expect(hints.header).toBe('mykey');
});
```

### Level 2: Visual Regression Tests

Use Playwright to capture screenshots and compare:

**tests/visual/phase2-code-view.spec.ts:**
```typescript
test('renders simple interpolation', async ({ page }) => {
  // Load test fixture
  const ir = loadFixture('simple-interpolation/ir.json');

  // Render widget
  await page.goto('/widget-test.html');
  await page.evaluate((irData) => {
    initWidget(irData);
  }, ir);

  // Capture screenshot
  await expect(page.locator('.tp-code-view')).toHaveScreenshot('simple-interpolation-code.png');
  await expect(page.locator('.tp-preview')).toHaveScreenshot('simple-interpolation-preview.png');
});

test('renders headers at multiple levels', async ({ page }) => {
  const ir = loadFixture('render-hints/header-nesting/ir.json');
  // ... similar test ...
});

test('renders combined header and XML', async ({ page }) => {
  const ir = loadFixture('render-hints/combined/ir.json');
  // ... similar test ...
});

test('renders images as thumbnails', async ({ page }) => {
  const ir = loadFixture('images/thumbnail/ir.json');
  // ... similar test ...
});
```

### Level 3: Python Consistency Tests

**Critical:** Ensure JavaScript output matches Python exactly

**tests/test_widget_consistency.py:**
```python
import json
import pytest
from t_prompts import prompt, dedent
from pathlib import Path

def test_simple_interpolation_consistency():
    """Test that JS string matches Python string"""
    # Create prompt
    task = "Analyze the code"
    p = prompt(t"Task: {task:t}")

    # Get Python output
    ir = p.render()
    python_string = ir.text

    # Export IR
    ir_json = ir.toJSON()

    # Save as test fixture
    fixture_dir = Path('tests/fixtures/phase2/simple-interpolation')
    fixture_dir.mkdir(parents=True, exist_ok=True)

    with open(fixture_dir / 'ir.json', 'w') as f:
        json.dump(ir_json, f, indent=2)

    with open(fixture_dir / 'expected-string.txt', 'w') as f:
        f.write(python_string)

    # JavaScript test will load ir.json, render, and compare to expected-string.txt

def test_header_hint_consistency():
    """Test header hints match Python"""
    content = "This is the content"
    p = prompt(t"{content:c:header=Section}")

    ir = p.render()
    python_string = ir.text

    # Should be: "# Section\nThis is the content"
    assert python_string == "# Section\nThis is the content"

    # Save fixture...

def test_xml_hint_consistency():
    """Test XML hints match Python"""
    reasoning = "My thought process"
    p = prompt(t"{reasoning:r:xml=thinking}")

    ir = p.render()
    python_string = ir.text

    # Should be: "<thinking>\nMy thought process\n</thinking>"
    assert python_string == "<thinking>\nMy thought process\n</thinking>"

    # Save fixture...

def test_combined_hints_consistency():
    """Test combined header+XML match Python"""
    analysis = "Step 1: Identify\nStep 2: Solve"
    p = prompt(t"{analysis:a:header=Analysis:xml=process}")

    ir = p.render()
    python_string = ir.text

    expected = "# Analysis\n<process>\nStep 1: Identify\nStep 2: Solve\n</process>"
    assert python_string == expected

    # Save fixture...
```

**tests/visual/phase2-consistency.spec.ts:**
```typescript
test('JavaScript string matches Python string', async ({ page }) => {
  const fixtures = [
    'simple-interpolation',
    'nested-prompts',
    'render-hints/header-basic',
    'render-hints/xml-basic',
    'render-hints/combined',
    'lists/with-separator',
    'complex-nesting'
  ];

  for (const fixture of fixtures) {
    const ir = loadFixture(`${fixture}/ir.json`);
    const expectedString = loadFixture(`${fixture}/expected-string.txt`);

    // Build string with JavaScript
    const { string } = buildCodeViewAndString(ir.source_prompt);
    const jsString = string.getText();

    // Compare
    expect(jsString).toBe(expectedString);
  }
});
```

### Level 4: Mapping Integrity Tests

**tests/integration/phase2-mapping.spec.ts:**
```typescript
test('bidirectional lookup: code → preview → code', async ({ page }) => {
  const ir = loadFixture('complex-nesting/ir.json');

  // Build everything
  const { codeView, string } = buildCodeViewAndString(ir.source_prompt);
  const markdown = string.getText();
  const { html, mappings } = markdownRenderer.render(markdown);
  const mapper = new InteractivityMapper(codeView, string, mappings);

  // Get all code spans
  const codeSpans = mapper.getAllCodeSpans();

  for (const codeSpan of codeSpans) {
    const elementId = codeSpan.getAttribute('data-element-id');

    // code → preview
    const previewElements = mapper.getPreviewFromCodeSpan(codeSpan);

    if (previewElements.length > 0) {
      // preview → code
      const backToCode = previewElements.flatMap(pe =>
        mapper.getCodeSpansFromPreview(pe)
      );

      // Should include original code span
      expect(backToCode).toContain(codeSpan);
    }
  }
});

test('position lookup returns correct elements', () => {
  const mapper = /* build mapper */;
  const string = /* get string */;

  // Test every character position
  for (let i = 0; i < string.getText().length; i++) {
    const elementId = mapper.getElementIdFromPosition(i);

    // Should find an element for every position
    expect(elementId).not.toBeNull();

    // Element should contain this position
    const info = mapper.debugGetCodeInfo(elementId);
    expect(i).toBeGreaterThanOrEqual(info.stringStart);
    expect(i).toBeLessThan(info.stringEnd);
  }
});
```

### Test Fixtures Directory Structure

```
tests/fixtures/phase2/
├── simple-interpolation/
│   ├── ir.json
│   └── expected-string.txt
├── nested-prompts/
│   ├── ir.json
│   └── expected-string.txt
├── render-hints/
│   ├── header-basic/
│   │   ├── ir.json
│   │   └── expected-string.txt
│   ├── header-nesting/
│   │   ├── ir.json
│   │   └── expected-string.txt
│   ├── xml-basic/
│   │   ├── ir.json
│   │   └── expected-string.txt
│   └── combined/
│       ├── ir.json
│       └── expected-string.txt
├── lists/
│   ├── with-separator/
│   │   ├── ir.json
│   │   └── expected-string.txt
│   └── nested-lists/
│       ├── ir.json
│       └── expected-string.txt
├── images/
│   ├── thumbnail/
│   │   ├── ir.json
│   │   └── expected-string.txt (empty or [image] placeholder)
│   └── multiple-images/
│       ├── ir.json
│       └── expected-string.txt
└── complex-nesting/
    ├── ir.json
    └── expected-string.txt
```

## Implementation Checklist

### Milestone 0: Documentation
- [x] Create `docs/developer/phase-2-rendering-architecture.md`
- [ ] Add architecture diagrams
- [ ] Document API surface for each component

### Milestone 1: Structured Code View (Phase 2A)
- [ ] Create `widgets/src/dom-builder.ts`
  - [ ] `createSpan()` function
  - [ ] `createImage()` function
  - [ ] `createDiv()` function
  - [ ] Unit tests for helpers
- [ ] Create `widgets/src/code-view-builder.ts`
  - [ ] `CodeViewBuilder` class
  - [ ] `addStatic()` method
  - [ ] `addInterpolation()` method
  - [ ] `addImage()` method
  - [ ] `addNestedPrompt()` method
  - [ ] `addList()` method
  - [ ] Unit tests for builder
- [ ] Update `widgets/src/renderer.ts`
  - [ ] Replace `renderCodeFromChunks()` with DOM builder
  - [ ] Replace `renderCodeFromPrompt()` with DOM builder
  - [ ] Walk IR source_prompt structure
  - [ ] Handle all element types
- [ ] Create visual tests
  - [ ] Test simple interpolation renders
  - [ ] Test nested prompts render
  - [ ] Test lists render
  - [ ] Test images appear as thumbnails
  - [ ] Test complex nesting

### Milestone 2: Position Tracking (Phase 2B)
- [ ] Create `widgets/src/string-mapper.ts`
  - [ ] `StringWithMapping` class
  - [ ] `append()` method
  - [ ] `getText()` method
  - [ ] `getPositions()` method
  - [ ] `getElementAtPosition()` method
  - [ ] Unit tests for position tracking
- [ ] Update renderer to build string in parallel
  - [ ] Modify walk function to track positions
  - [ ] Ensure same element IDs used for both
- [ ] Add position tracking tests
  - [ ] Test position ranges are correct
  - [ ] Test lookup by position works
  - [ ] Test edge cases (empty strings, etc.)

### Milestone 3: Render Hints (Phase 2C)
- [ ] Create `widgets/src/render-hints.ts`
  - [ ] `parseRenderHints()` function
  - [ ] `applyHeaderHint()` function
  - [ ] `applyXmlHint()` function
  - [ ] `trackHeaderLevel()` helper
  - [ ] Unit tests for parsing and applying hints
- [ ] Update renderer to apply render hints
  - [ ] Integrate header hint support
  - [ ] Integrate XML hint support
  - [ ] Track header level through nesting
  - [ ] Ensure correct ordering (header outer, XML inner)
- [ ] Create Python consistency tests
  - [ ] Generate test fixtures from Python
  - [ ] Test JavaScript string matches Python
  - [ ] Test all render hint combinations
- [ ] Create visual tests for render hints
  - [ ] Test headers at multiple levels
  - [ ] Test XML wrappers
  - [ ] Test combined header + XML
  - [ ] Test header level nesting

### Milestone 4: Markdown Mapping (Phase 2D)
- [ ] Create `widgets/src/markdown-mapper.ts`
  - [ ] `createMarkdownWithMapping()` function
  - [ ] Custom renderer rules for position tracking
  - [ ] Character position calculation from lines
  - [ ] `MarkdownMapping` interface
  - [ ] Unit tests for markdown mapping
- [ ] Test position accuracy
  - [ ] Test headers map correctly
  - [ ] Test paragraphs map correctly
  - [ ] Test lists map correctly
  - [ ] Test character positions are accurate

### Milestone 5: Bidirectional Lookup (Phase 2E)
- [ ] Create `widgets/src/interactivity-mapper.ts`
  - [ ] `InteractivityMapper` class
  - [ ] `getPreviewFromCodeSpan()` method
  - [ ] `getCodeSpansFromPreview()` method
  - [ ] `getElementIdFromPosition()` method
  - [ ] Helper methods for range checking
  - [ ] Unit tests for mapper
- [ ] Create integration tests
  - [ ] Test code → preview → code round trip
  - [ ] Test preview → code → preview round trip
  - [ ] Test with complex nested structures
  - [ ] Test edge cases
- [ ] Performance tests
  - [ ] Test with 1000+ elements
  - [ ] Measure lookup time
  - [ ] Ensure acceptable performance

## Success Criteria

Phase 2 is complete when:

1. ✅ Widget code view shows properly nested span structure with element IDs
2. ✅ All element types render correctly:
   - Static text
   - Interpolations
   - Nested prompts
   - Lists with separators
   - Images as thumbnails
3. ✅ Render hints work correctly:
   - Headers at various levels
   - XML wrappers
   - Combined header + XML
   - Header level nesting
4. ✅ JavaScript string output matches Python `str(prompt)` exactly (100% consistency across all test cases)
5. ✅ Bidirectional mapping works:
   - Can look up preview elements from code spans
   - Can look up code spans from preview elements
   - Round-trip lookups return original elements
6. ✅ All tests pass:
   - Unit tests (100% of new code)
   - Visual regression tests (all fixtures)
   - Python consistency tests (all fixtures match)
   - Mapping integrity tests (all lookups work)
7. ✅ Documentation is complete:
   - Architecture documented
   - Code has comprehensive comments
   - Examples provided
8. ✅ Code quality:
   - Clean, readable code
   - Proper TypeScript types
   - No linting errors
   - Follows project conventions

## Next Steps (Phase 3+)

With Phase 2 complete, we'll have the infrastructure for:

1. **Hover Synchronization:**
   - Hover over code span → highlight preview elements
   - Hover over preview → highlight code spans
   - Use InteractivityMapper for lookups

2. **Click Navigation:**
   - Click code span → scroll to preview
   - Click preview → scroll to code span

3. **Selection Mirroring:**
   - Select text in code → highlight corresponding preview
   - Select text in preview → highlight corresponding code

4. **Tree View:**
   - Show hierarchical structure of prompt
   - Click tree node → highlight code and preview

5. **Source Location:**
   - Show Python source file and line number
   - Jump to source (in IDE integration scenarios)

All of these features will be straightforward to implement once Phase 2's mapping infrastructure is complete.

## References

- [IR toJSON Format](./ir-to-json-format.md) - Complete IR JSON specification
- [toJSON Format](./to-json-format.md) - StructuredPrompt JSON specification
- [Testing Guide](./testing.md) - How to run tests
- [Setup Guide](./setup.md) - Development environment setup
