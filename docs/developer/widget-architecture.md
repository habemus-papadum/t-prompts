# Widget Architecture

This document describes the architecture of the TypeScript widget system for visualizing structured prompts in Jupyter notebooks and HTML exports.

## Overview

The widget system consists of a TypeScript/JavaScript bundle that renders structured prompt data in web browsers. Python code generates HTML with embedded JSON data, and the TypeScript code discovers and renders these widgets dynamically.

## File Structure

```
widgets/
├── src/
│   ├── index.ts          (119 lines) - Entry point, initialization, auto-discovery
│   ├── renderer.ts       (129 lines) - Core rendering logic
│   ├── styles.css        (115 lines) - Widget styles
│   └── index.test.ts     (30 lines)  - Tests
├── dist/
│   ├── index.js          - Bundled output (copied to src/t_prompts/widgets/)
│   ├── index.js.map      - Source map
│   └── katex.css         - KaTeX math rendering styles
├── build.js              - esbuild configuration
└── package.json          - Dependencies: markdown-it, katex
```

### Source Files

#### `index.ts` - Widget Runtime & Discovery

**Purpose**: Entry point that sets up the widget system and auto-discovers widget containers on the page.

**Key Functions**:

- **`initRuntime()`** - Creates global `window.__TPWidget` singleton with:
  - `version`: Widget version string
  - `initWidget`: Reference to the rendering function
  - `stylesInjected`: Flag to prevent duplicate style injection

- **`injectStyles()`** - Injects CSS into document `<head>` once per page (singleton pattern)

- **`autoInit()`** - Automatically initializes all widgets when DOM loads:
  ```typescript
  document.querySelectorAll('[data-tp-widget]')
    .forEach(container => initWidget(container))
  ```

- **MutationObserver** - Watches DOM for dynamically added widgets, important for Jupyter notebooks where cells are added/removed dynamically

#### `renderer.ts` - Widget Rendering

**Purpose**: Parses JSON data embedded in HTML and generates the widget output.

**Key Function**: `initWidget(container: HTMLElement)`

**Current Implementation** (simplified):
```typescript
export function initWidget(container: HTMLElement): void {
  // 1. Find embedded JSON data
  const scriptTag = container.querySelector('script[data-role="tp-widget-data"]')
  const data: WidgetData = JSON.parse(scriptTag.textContent)

  // 2. Extract chunks from intermediate representation
  const chunks = data.ir.chunks  // Array of TextChunk | ImageChunk

  // 3. Render chunks (escapes text, embeds base64 images)
  const contentHtml = renderChunks(chunks)

  // 4. Mount to DOM
  mountPoint.innerHTML = `<div class="tp-widget-output"><pre>${contentHtml}</pre></div>`
}
```

**Type Interfaces**:

- `WidgetData` - Top-level structure with `ir`, `source_prompt`, `compiled_ir` fields
- `ChunkData` - Individual chunks: `TextChunk` (text content) or `ImageChunk` (base64 images)
- `IRData` - Intermediate representation with chunks array
- `PromptData` - Source prompt structure with children elements
- `ImageData` - Image metadata: base64_data, format, width, height

#### `styles.css` - Visual Design

Provides theming and layout structure:

- **CSS Custom Properties** - Theming system with light/dark mode support
- **`.tp-widget-container`** - Three-pane grid layout (for future use)
- **`.tp-pane`** - Individual pane base styles
- **`.tp-tree`, `.tp-code`, `.tp-preview`** - Content container styles
- **`.tp-error`** - Error display styling
- **Responsive breakpoints** - Adapts layout for different screen sizes

## Complete Rendering Flow

### Step 1: Python Generates HTML

When a `StructuredPrompt` or `IntermediateRepresentation` is displayed in Jupyter:

```python
# In Python:
p = prompt(t"Task: {task:t}")
html = p._repr_html_()  # Jupyter calls this automatically

# _repr_html_() internally calls:
def render_structured_prompt_html(prompt):
    data = prompt.toJSON()  # Serialize to JSON
    return _render_widget_html(data)

def _render_widget_html(data):
    json_data = json.dumps(data)
    js_bundle = get_widget_bundle()  # Read compiled index.js

    # Return HTML with:
    # 1. JavaScript bundle (injected once per notebook)
    # 2. Widget container with embedded JSON
    return f'''
    <script id="tp-widget-bundle">{js_bundle}</script>  <!-- Injected once -->
    <div class="tp-widget-root" data-tp-widget>
        <script data-role="tp-widget-data" type="application/json">
            {json_data}
        </script>
        <div class="tp-widget-mount"></div>
    </div>
    '''
```

**Key Points**:
- JavaScript bundle is injected once per notebook using a singleton pattern (`_bundle_injected` flag)
- Each widget contains its own JSON data embedded in a `<script>` tag
- The JSON is inert (not executed) and safe from XSS attacks

### Step 2: Browser Loads HTML

When the HTML enters the browser:

1. **JavaScript bundle executes** (from the first widget's `<script>` tag)
2. **`index.ts` runs automatically**:
   ```typescript
   if (document.readyState === 'loading') {
     document.addEventListener('DOMContentLoaded', autoInit)
   } else {
     autoInit()  // DOM already ready
   }
   ```

### Step 3: Widget Discovery & Initialization

```typescript
function autoInit() {
  initRuntime()        // Set up window.__TPWidget singleton
  injectStyles()       // Inject CSS once

  // Find all widget containers
  document.querySelectorAll('[data-tp-widget]').forEach(container => {
    if (!container.dataset.tpInitialized) {
      initWidget(container)                     // Render this widget
      container.dataset.tpInitialized = 'true'  // Mark as initialized
    }
  })
}
```

**MutationObserver** continues watching for new widgets added dynamically (e.g., when Jupyter creates new output cells).

### Step 4: Widget Rendering

```typescript
function initWidget(container: HTMLElement) {
  try {
    // 1. Extract JSON from embedded <script> tag
    const scriptTag = container.querySelector('script[data-role="tp-widget-data"]')
    const data = JSON.parse(scriptTag.textContent)

    // 2. Process the intermediate representation
    const chunks = data.ir.chunks

    // 3. Render each chunk
    let html = ''
    for (const chunk of chunks) {
      if (chunk.type === 'TextChunk') {
        html += escapeHtml(chunk.text)  // Safe HTML escaping
      } else if (chunk.type === 'ImageChunk') {
        const src = `data:image/${chunk.image.format};base64,${chunk.image.base64_data}`
        html += `<img src="${src}" alt="Image" style="..." />`
      }
    }

    // 4. Mount to DOM
    const mountPoint = container.querySelector('.tp-widget-mount')
    mountPoint.innerHTML = `<div class="tp-widget-output"><pre>${html}</pre></div>`

  } catch (error) {
    // Display error message in widget
    container.innerHTML = `<div class="tp-error">Failed to initialize widget: ${error.message}</div>`
  }
}
```

## Data Flow Mechanism

The key mechanism is **JSON-in-HTML**:

1. **Python serializes** the prompt structure to JSON using `toJSON()`
2. **Python embeds** the JSON inside a `<script type="application/json">` tag in HTML
3. **Browser parses** the HTML (script tag is inert, not executed as JavaScript)
4. **TypeScript extracts** JSON by querying the DOM: `querySelector('script[data-role="tp-widget-data"]')`
5. **TypeScript parses** JSON and generates HTML dynamically
6. **TypeScript mounts** the generated HTML into the widget container

### Why This Pattern?

This approach is used by modern frameworks (e.g., Next.js hydration):

- ✅ **Safe**: JSON is safely embedded, not executable code
- ✅ **Secure**: No XSS vulnerabilities (`JSON.parse` is safe)
- ✅ **Universal**: Works in any environment (Jupyter, HTML export, web pages)
- ✅ **Simple**: Single source of truth (JSON is data, HTML is just a wrapper)
- ✅ **Inspectable**: Users can view JSON in browser DevTools

## Build Process

When you run `pnpm build` (or `npm run build` from project root):

1. **esbuild bundles** `index.ts` → `dist/index.js`
   - Format: IIFE (Immediately Invoked Function Expression)
   - Global name: `TPromptsWidgets`
   - Target: ES2020
   - Bundled with dependencies (markdown-it, katex)
   - Minified with source maps

2. **CSS imported as text** - `styles.css` is loaded as a string and injected at runtime

3. **KaTeX CSS extracted** - Copied from `node_modules/katex/dist/katex.min.css` to `dist/katex.css`

4. **Files copied to Python package**:
   - `dist/index.js` → `src/t_prompts/widgets/index.js`
   - `dist/index.js.map` → `src/t_prompts/widgets/index.js.map`
   - `dist/katex.css` → `src/t_prompts/widgets/katex.css`

The Python package then reads `index.js` at runtime and injects it into notebook HTML.

### Build Configuration

From `build.js`:
```javascript
esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  sourcemap: true,
  target: ['es2020'],
  format: 'iife',
  globalName: 'TPromptsWidgets',
  outfile: 'dist/index.js',
  platform: 'browser',
  loader: { '.css': 'text' },
})
```

## Widget Lifecycle

1. **Build Time**: TypeScript compiled to JavaScript bundle
2. **Python Runtime**: Bundle read from disk and embedded in HTML
3. **Browser Load**: JavaScript executes, sets up runtime
4. **Discovery**: Widgets found via `[data-tp-widget]` selector
5. **Initialization**: Each widget's JSON extracted and rendered
6. **DOM Update**: Generated HTML mounted into widget container
7. **Continuous Monitoring**: MutationObserver watches for new widgets

## Future Development

The current implementation uses a simplified renderer that displays only the intermediate representation. The CSS includes structural elements for a three-pane layout:

- **Structure Pane**: Tree view of prompt elements
- **Code Pane**: Syntax-highlighted code view
- **Preview Pane**: Markdown-rendered preview

These structural CSS classes are preserved for future enhancement of the widget rendering capabilities.

## Dependencies

- **markdown-it**: Markdown parsing and rendering
- **markdown-it-katex**: KaTeX math rendering plugin
- **katex**: LaTeX math rendering
- **esbuild**: Fast JavaScript bundler
- **TypeScript**: Type-safe development
- **vitest**: Testing framework

## Testing

Widget tests use **vitest** with **jsdom** for DOM simulation:

```bash
cd widgets
pnpm test        # Run tests once
pnpm test:watch  # Watch mode
```

Visual tests use Playwright (in `tests/visual/`) to verify rendering in real browsers.

## Debugging

To debug widget rendering:

1. **Browser DevTools**: Inspect the widget container HTML
2. **Find JSON data**: Look for `<script data-role="tp-widget-data">`
3. **Check initialization**: Look for `data-tp-initialized="true"` attribute
4. **Console errors**: Check browser console for JavaScript errors
5. **Source maps**: Use `index.js.map` to debug TypeScript source

Common issues:
- Widget not rendering: Check if `[data-tp-widget]` attribute exists
- JSON parsing errors: Validate JSON structure matches expected schema
- Styles not applied: Check if CSS was injected into `<head>`
- Bundle not loaded: Verify `src/t_prompts/widgets/index.js` exists
