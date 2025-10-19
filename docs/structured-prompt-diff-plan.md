# Structured Prompt Diff Overlay Plan

## Goals
- Extend the existing Structured Prompt widget so it can optionally display diff context (before prompt, structured diff, rendered diff) alongside the compiled IR of the "after" prompt.
- Preserve current behavior when diff inputs are missing.
- Provide intuitive controls for toggling diff visualization without overwhelming the core prompt exploration workflows.

## Assumptions
- Widget already receives compiled IR for the active ("after") prompt.
- New inputs are delivered as JSON payloads alongside the compiled IR: `prior_prompt_ir`, `structured_diff`, `rendered_diff`.
- Diff data is internally consistent (node IDs, chunk IDs, ranges) and matches the schema used by `StructuredPromptDiff` / `RenderedPromptDiff`.
- When data is missing, the widget must hide all diff UI affordances and operate exactly as today.

## High-Level UX Concept
1. **Diff Toggle Bar**
   - Add a compact toolbar in the widget header with a toggle switch labeled “Show diff”.
   - Toggle is disabled (hidden) when diff payloads are absent.
   - When enabled, diff overlays activate across the widget views; when disabled, the widget reverts to the existing pure “after” prompt view.

2. **Tree View Enhancements**
   - Overlay status icons (e.g., `+`, `−`, `↷`) using pill badges next to node labels to indicate added, removed, and moved nodes.
   - Highlight background/border of affected nodes using color-coded left ribbons (green for additions, red for deletions, purple for moves).
   - Introduce ghost nodes for deletions: collapsible sections rendered in a faded style at the bottom of the tree or grouped under a “Removed” parent. These nodes show the prior hierarchy with strikethrough text.
   - Provide metrics summary (additions/deletions/moves) in the tree header when diff mode is active.

3. **Chunk / Code View Enhancements**
   - Continue showing the sequence of chunks for the compiled IR.
   - For each chunk, display addition/deletion overlays:
     - Added text: green left border plus subtle background tint; optional leading `▎` glyph to avoid conflicting with current borders.
     - Deleted text: render as inline callouts below the corresponding chunk with red outlines and strikethrough, using the rendered diff spans to position them. If no anchor chunk exists (pure deletion), render as separate ghost chunk in chronological order based on diff metadata.
   - Show inline markers within chunks (similar to IDE gutter markers) for changed lines; hover reveals tooltip with diff summary from rendered diff (e.g., `− old text`, `+ new text`).

4. **Markdown Rendering**
   - Leverage rendered diff: show Markdown preview with change callouts using `<ins>` / `<del>` styling. Convert diff spans to highlight tokens while respecting Markdown semantics. For block-level deletions without anchors, add collapsible “Removed content” panels below the relevant section.

5. **Details Sidebar (Optional)**
   - Add a secondary panel (collapsed by default) listing diff metadata: counts, top-level moved sections, rendered diff summary. Useful for power users; accessible via an info icon in the header.

## Data Flow and Model Changes
- **Front-end**
  - Update TypeScript types in `widgets/src/diff-types.ts` to include optional `before_prompt_ir`, `structured_diff`, `rendered_diff` fields in the payload consumed by the Structured Prompt widget renderer.
  - Normalize incoming JSON to internal diff structures (reuse existing `StructuredPromptDiffData` types for node deltas, text edits).
  - Extend widget state machine to store `diffEnabled` boolean and diff payload caches.
- **Python Back-end**
  - Extend serialization helpers (e.g., `src/t_prompts/widgets/export.py`) to package the prior prompt IR and diff JSON when available.
  - Ensure `_repr_html_` / preview helpers pass diff context through the widget view model.

## Component-Level Work
1. **Renderer / Entry Point**
   - Modify `widgets/src/renderer.ts` so the default Structured Prompt widget builder can interpret combined prompt + diff payloads. Introduce a discriminated union type or configuration object specifying `mode: 'prompt' | 'prompt-with-diff'`.
   - Ensure fallback to existing builder when diff data is absent.

2. **Structured Prompt View Component**
   - Refactor existing view into a base component responsible for layout (header, tabs for tree/chunks/markdown) and slots for overlays.
   - Integrate the diff toggle into the header; propagate `diffEnabled` state to child components.

3. **Tree View**
   - Implement overlay layering: base tree representing the “after” prompt plus diff-specific decorators that read `structured_diff.node_deltas`.
   - Create helper functions to compute node status (added/removed/moved/modified) and to synthesize ghost nodes from deletions.
   - Ensure tree virtualization / expansion logic handles ghost nodes without breaking navigation.

4. **Chunk / Rendered Views**
   - Use `rendered_diff.text_edits` to annotate chunk DOM nodes. Map edit ranges to chunk IDs via metadata already present in compiled IR.
   - For ghost chunks, fabricate DOM nodes with class `tp-chunk--deleted` and attach diff metadata for tooltips.
   - Provide accessible color palette (WCAG contrast) and avoid conflicting with existing backgrounds.

5. **State Synchronization**
   - Centralize diff toggle state in a store (e.g., simple event emitter or context). Ensure switching views preserves toggle.
   - Allow programmatic toggling (future automation) by adding optional query parameter / data attribute.

6. **Testing**
   - Unit tests for TypeScript components covering: toggle visibility, diff overlay rendering, ghost nodes, fallback behavior.
   - Snapshot tests for chunk markup with diff overlays.
   - Python integration tests to verify widget HTML includes diff payload when provided and excludes when absent.

## Accessibility & UX Considerations
- Provide text equivalents for color-coded statuses (aria labels, screen reader descriptions).
- Ensure toggle is keyboard accessible and diff overlays do not disrupt existing focus order.
- Consider user preference persistence (localStorage) for diff toggle default.

## Documentation & Demo Updates
- Document diff overlay usage in `docs/features.md` (future work) and create a dedicated demo notebook showing before/after with diff toggle.
- Update `docs/demos` to include new screenshots or GIFs.

## Implementation Phases
1. **Data Plumbing** – Introduce optional diff payload wiring in both Python and JS layers; confirm backward compatibility.
2. **UI Toggle + Skeleton** – Add header toggle and placeholder overlays that visually indicate diff availability.
3. **Tree Overlay Implementation** – Render badges, ghost nodes, metrics, and ensure navigation works.
4. **Chunk & Markdown Overlays** – Apply rendered diff styling, ghost chunks, tooltips.
5. **Polish & Accessibility** – Refine styles, ensure contrast, add keyboard support.
6. **Docs & Demos** – Update documentation and add interactive/static demos.

## Risks & Mitigations
- **Complexity Explosion**: Keep overlays opt-in and modular to avoid performance hits when diff disabled.
- **Data Alignment Issues**: Add validation to ensure diff spans map cleanly to chunks; log warnings when they don’t.
- **Visual Noise**: Offer compact styling and collapse options for large deletion sets.

## Open Questions
- Should diff toggle default to on when diff data present? (Current assumption: on.).
ANSWER: YES
- Do we need granular filters (e.g., hide moves)? Possibly future enhancement.
ANSWER: Not now
- How should we handle conflicting diff spans? Consider fallback to inline text diff view.
ANSWER: TBD

Additional comments
When Diffs are available, consider provding the diff metrics for both as a subtool bar/narrow header ; these should be probably be made into reusable widgets -- they should be based on the metrics in the current StructuredDiff and RenderedDiff Widgets.

StructuredDiff and RenderedDiff Widgets are narrow debugging tools -- aside from the metrics, they are not good foundations / visual representations for this work -- this work seekd to weave diff information into the existinf display.

Visual feedback and observation is important during planning and at the end of various steps.
Consider using playwright based screen captures to observe the actual visual appearance. the
instructions for playwright are in the AGENTS.md.  You can create scratch scripts in /scratchpad.
Refer to src/t_prompts/widgets for examples of such script that create images.

---

## Design Changes from Original Plan

### Separate Before/After Panels Instead of Inline Overlays

**Decision:** Rather than showing a single code view with inline diff annotations for both additions and deletions, we implemented a **dual-panel layout** with separate "before" and "after" code views.

**Layout:** `Tree | Before Code | After Code | Markdown`

**Rationale:**
- **Clarity:** Deletions are better understood in their original context rather than as ghost annotations in the after view
- **Independent Exploration:** Users can collapse/expand chunks independently in each view without state conflicts
- **Spatial Separation:** Side-by-side comparison is more intuitive for understanding structural changes
- **Reduced Noise:** Keeps the after (main) view focused on the current state while deletions live naturally in the before view

**Trade-offs:**
- Requires more horizontal space when all panels visible
- Adds complexity with multiple folding controllers
- Benefits outweigh costs for understanding larger diffs

### Toolbar-Based Controls

**Decision:** Integrated diff controls directly into the main toolbar rather than a separate diff bar.

**Controls:**
- Before view toggle button (document with left arrow icon)
- Diff overlay toggle button (diff icon)
- Diff metrics display (inline in toolbar)

**Ordering:** `Metrics | Before | Code | Markdown | Split | Diff Metrics | Diff Toggle | Scroll Sync | Help`

**Rationale:**
- Consolidates controls in familiar location
- Before button positioned before Code button to reinforce before→after relationship
- Diff toggle controls overlay visibility, not view switching
- Metrics provide at-a-glance summary without separate panel

### CSS-Based Overlay Toggle

**Decision:** Use `.tp-diff-enabled` CSS class on widget root to control diff overlay visibility rather than DOM reconstruction.

**Rationale:**
- Performance: No need to rebuild views when toggling
- Simplicity: Single class toggle cascades to all styled elements
- Reversibility: Easy to toggle on/off without state loss

---

## Implementation Details

### Phase 1: Data Plumbing (Python)

#### `src/t_prompts/ir.py` (lines 775-824)

Added `widget_with_diff()` method to `CompiledIR` class:

```python
def widget_with_diff(
    self,
    before: "StructuredPrompt",
    config: Optional["WidgetConfig"] = None,
) -> "Widget":
    from .diff import diff_rendered_prompts, diff_structured_prompts
    from .widgets import Widget, _render_widget_html

    data = self.widget_data(config)
    after = self._ir.source_prompt

    # Compute both structural and rendered diffs
    structured_diff = diff_structured_prompts(before, after)
    rendered_diff = diff_rendered_prompts(before, after)

    # Package into widget data
    data["before_prompt_ir"] = before.ir().toJSON()
    data["structured_diff"] = structured_diff.to_widget_data()
    data["rendered_diff"] = rendered_diff.to_widget_data()

    html = _render_widget_html(data, "tp-widget-mount")
    return Widget(html)
```

**Key Decisions:**
- Compute diffs at widget creation time (not lazily) to ensure consistency
- Include both structural and rendered diffs for different use cases
- Use existing `diff_structured_prompts()` and `diff_rendered_prompts()` functions
- Store before IR as JSON for frontend reconstruction

#### `src/t_prompts/structured_prompt.py` (lines 691-722)

Added convenience `widget_with_diff()` method that delegates to compiled IR:

```python
def widget_with_diff(self, before: "StructuredPrompt", config: Optional["WidgetConfig"] = None) -> "Widget":
    ir = self.ir()
    compiled = ir.compile()
    return compiled.widget_with_diff(before, config)
```

**Rationale:** Allows calling from either IR or StructuredPrompt level for flexibility.

#### Demo Files

Created two demonstration files:
- `src/t_prompts/widgets/demos/demo_diff_overlay_simple.py` - Simple text modifications (email draft)
- `src/t_prompts/widgets/demos/demo_diff_overlay_complex.py` - Complex structural changes (API specification)

**Key Implementation Detail:** JSON literals inside Python t-strings require double-brace escaping:
```python
# Wrong - causes ValueError
response = t"""{"id": 1}"""

# Correct - escapes braces
response = t"""{{"id": 1}}"""
```

### Phase 2: TypeScript Data Layer

#### `widgets/src/types.ts` (lines 11-20)

Extended `WidgetData` interface with optional diff fields:

```typescript
export interface WidgetData {
  compiled_ir?: CompiledIRData;
  ir?: IRData;
  source_prompt?: PromptData;
  config?: ConfigData;
  // Optional diff overlay data
  before_prompt_ir?: IRData;
  structured_diff?: import('./diff-types').StructuredPromptDiffData;
  rendered_diff?: import('./diff-types').RenderedPromptDiffData;
}
```

**Rationale:**
- Optional fields maintain backward compatibility
- Import types lazily to avoid circular dependencies
- Reuse existing diff-types structures

#### `widgets/src/diff-types.ts`

Already contained complete type definitions for:
- `StructuredPromptDiffData` (node-level changes)
- `RenderedPromptDiffData` (chunk-level changes)
- `ChunkDelta` (individual chunk operations: insert/delete/replace/equal)

**No changes needed** - existing structures were well-designed for this use case.

### Phase 3: Before Code View Component

#### `widgets/src/components/BeforeCodeView.ts` (new file)

Created complete code view implementation for "before" state:

**Architecture:**
```typescript
export function buildBeforeCodeView(
  data: WidgetData,
  metadata: WidgetMetadata,
  foldingController: FoldingController  // Independent controller!
): BeforeCodeView
```

**Key Design Decisions:**

1. **Independent Folding Controller**
   - Before view gets its own `FoldingController` instance (created in WidgetContainer)
   - Prevents interference: collapsing chunks in "before" doesn't affect "after"
   - Maintains separate selection/collapse state for each view

2. **Modified Data Object**
   ```typescript
   const beforeData: WidgetData = {
     ...data,
     ir: data.before_prompt_ir,  // Swap in before IR
   };
   ```
   - Reuses existing transform pipeline by substituting IR
   - All downstream transforms work without modification

3. **Transform Pipeline** (same as CodeView but with different diff overlay):
   ```
   CreateChunks → AddTyping → ImageTruncate → LineWrap →
   ImageHoverPreview → BeforeDiffOverlay → MarkBoundaries
   ```

4. **Event Handling**
   - Full keyboard navigation (space to collapse, double-tap to expand all)
   - Selection tracking with debouncing
   - Double-click on collapsed chunks to expand
   - Same UX patterns as main CodeView for consistency

**Caveat:** Code duplication with CodeView.ts - future refactoring could extract shared base, but separation provides clarity during initial implementation.

### Phase 4: Diff Overlay Transforms

#### `widgets/src/transforms/beforeDiffOverlay.ts` (new file)

Marks chunks in the before view with delete/replace annotations:

**Algorithm:**
```typescript
export function applyTransform_BeforeDiffOverlay(state: TransformState): TransformState {
  const { chunks, data } = state;

  // Build map: element_id:text → ChunkDelta
  const beforeChunkMap = new Map<string, ChunkDelta>();
  for (const delta of data.rendered_diff.chunk_deltas) {
    if (delta.before && (delta.op === 'delete' || delta.op === 'replace')) {
      beforeChunkMap.set(`${delta.before.element_id}:${delta.before.text}`, delta);
    }
  }

  // Match chunks and apply classes
  for (const [chunkId, elements] of chunks.entries()) {
    const chunkData = data.before_prompt_ir.chunks.find(c => c.id === chunkId);
    const key = `${chunkData.element_id}:${chunkData.text}`;
    const delta = beforeChunkMap.get(key);

    if (delta) {
      for (const element of elements) {
        element.setAttribute('data-diff-op', delta.op);
        element.classList.add(delta.op === 'delete' ? 'tp-diff-delete' : 'tp-diff-replace-before');
      }
    }
  }
  return state;
}
```

**Key Design Choices:**
- **Matching Strategy:** Use `element_id:text` as composite key for reliable chunk matching
- **Only Delete/Replace:** Before view only cares about what was removed or changed
- **Data Attributes:** Store operation type for potential debugging/testing
- **CSS Classes:** Separate classes for different operations enable targeted styling

**Why element_id:text?**
- Chunk IDs differ between before/after IRs
- Element IDs are stable across versions (provenance tracking)
- Text provides additional discrimination when same element appears multiple times
- Handles edge cases like reordered list items

#### `widgets/src/transforms/diffOverlay.ts` (similar structure)

Marks chunks in the after view with insert/replace annotations:

**Differences from before overlay:**
- Filters for `delta.after` instead of `delta.before`
- Looks for `insert` and `replace` operations
- Uses `data.ir` (after IR) instead of `data.before_prompt_ir`
- Applies `.tp-diff-insert` and `.tp-diff-replace` classes

**Caveat:** Currently no special handling for moved chunks - both views show them as delete+insert. Future enhancement could add move detection.

### Phase 5: Container Layout & State Management

#### `widgets/src/components/WidgetContainer.ts`

**Dual Folding Controllers:**
```typescript
const foldingController = new FoldingController(initialChunkIds);  // For after view
const beforeFoldingController = hasDiffData(data)
  ? new FoldingController(beforeChunkIds)  // For before view
  : null;
```

**Before Panel Creation:**
```typescript
const beforeView = beforeFoldingController
  ? buildBeforeCodeView(data, metadata, beforeFoldingController)
  : null;

const beforePanel = beforeView ? document.createElement('div') : null;
if (beforePanel && beforeView) {
  beforePanel.className = 'tp-panel tp-before-panel hidden';  // Initially hidden
  beforePanel.appendChild(beforeView.element);
}
```

**Layout Assembly:**
```typescript
contentArea.appendChild(treeContainer);
contentArea.appendChild(treeResizer);
if (beforePanel) {
  contentArea.appendChild(beforePanel);  // Before goes between tree and main split
}
contentArea.appendChild(mainSplit);  // Contains after code + markdown
```

**Diff State Management:**
```typescript
const diffDataAvailable = hasDiffData(data);

// Diff toggle callback
onDiffToggle: diffDataAvailable ? (enabled: boolean) => {
  element.classList.toggle('tp-diff-enabled', enabled);  // CSS class controls overlays
} : undefined,

// Before view toggle callback
onBeforeToggle: diffDataAvailable ? (show: boolean) => {
  beforePanel?.classList.toggle('hidden', !show);
} : undefined,
```

**Key Decisions:**
- **CSS-Based Toggle:** `.tp-diff-enabled` class controls all overlay visibility
- **Panel Visibility:** Simple `.hidden` class toggle (display: none)
- **Conditional Callbacks:** Only register callbacks when diff data available
- **Default State:** Diff enabled by default, before panel hidden by default

**Rationale:**
- Minimal state management - let CSS do the work
- No view reconstruction on toggle - better performance
- Before panel hidden by default to avoid overwhelming users
- All diff UI elements invisible when no diff data (backward compatible)

### Phase 6: Toolbar Integration

#### `widgets/src/components/Toolbar.ts`

**New Toolbar Elements:**

1. **Diff Metrics Display** (lines 350-365):
   ```typescript
   function createDiffMetricsDisplay(diffData: DiffMetrics): HTMLElement {
     const { structured, rendered } = diffData;
     const addedNodes = structured.stats.nodes_added || 0;
     const removedNodes = structured.stats.nodes_removed || 0;
     const insertChunks = rendered.stats.insert || 0;
     const deleteChunks = rendered.stats.delete || 0;

     metricsText.textContent = `${addedNodes}+ ${removedNodes}− nodes, ${insertChunks}+ ${deleteChunks}− chunks`;
   }
   ```
   - Shows both structural and rendered diff stats
   - Compact format fits in toolbar
   - Tooltip provides additional detail

2. **Before View Toggle Button** (lines 114-125, 377-392):
   ```typescript
   before: (): SVGElement => {
     // Document with left arrow icon
     svg.innerHTML =
       '<path d="M4 1.5v13h8v-13H4zm7 12H5v-11h6v11z"/>' +
       '<path d="M7.5 8H10V7H7.5V5.5L5.5 7.5 7.5 9.5V8z" fill="currentColor"/>';
   }
   ```
   - Clear icon: document with left-pointing arrow
   - More prominent than original circular arrow
   - Positioned before Code button to reinforce ordering

3. **Diff Toggle Button** (lines 333-348):
   - Reuses diff icon from icons library
   - Simple active/inactive states
   - Positioned after metrics display

**Toolbar Ordering:**
```
[Metrics] | [Before] | [Code] [Markdown] [Split] | [Diff Metrics] [Diff Toggle] | [Scroll Sync] [Help]
```

**Rationale:**
- Before button logically precedes Code (after) button
- Diff controls grouped together
- Metrics visible but not intrusive
- Consistent with existing toolbar patterns

### Phase 7: CSS Styling

#### `widgets/src/styles.css`

**Before Panel Width** (lines 537-542):
```css
.tp-before-panel {
  flex: 0 0 auto;
  width: var(--tp-before-width, 33%);
  min-width: 160px;
  max-width: none;
}
```
- Fixed 33% width matches after code panel in split view
- Prevents flex shrinking that caused squishing
- CSS variable allows future customization

**Diff Overlay Styles** (lines 1506-1525):
```css
/* Light mode */
.tp-diff-enabled .tp-diff-delete {
  border-left: 3px solid #d73a49;
  background: rgba(215, 58, 73, 0.10);
  text-decoration: line-through;
  opacity: 0.7;
}

/* Enhanced for before panel */
.tp-before-panel .tp-diff-delete {
  border-left: 4px solid #d73a49;     /* Thicker border */
  background: rgba(215, 58, 73, 0.18); /* More opacity */
  opacity: 1;                          /* Full visibility */
  font-weight: 500;                    /* Bolder text */
}
```

**Design Rationale:**
- **Conditional Display:** `.tp-diff-enabled` prefix ensures overlays only show when toggled on
- **Visual Hierarchy:** Before panel gets more prominent delete styling (users need to see what was removed)
- **Color Coding:** Green (insert), Red (delete), Orange (replace) - standard diff conventions
- **Accessibility:** Sufficient contrast ratios, not relying solely on color (also uses borders, strikethrough)
- **Dark Mode Support:** Separate rules with adjusted colors for dark theme

**Border Strategy:**
- Left border provides strong visual anchor
- Doesn't interfere with existing element boundary markers
- 3px standard, 4px for emphasis in before panel
- Consistent with existing UI patterns in codebase

### Key Algorithms & Data Flow

#### Chunk Matching Algorithm

**Problem:** Before and after IRs have different chunk IDs, need to match chunks across versions for diff annotations.

**Solution:** Composite key matching using element provenance + text content.

```typescript
// Build index during diff overlay transform
const key = `${chunkData.element_id}:${chunkData.text}`;
const delta = chunkMap.get(key);
```

**Why This Works:**
- `element_id` from provenance system is stable across versions
- Text content disambiguates when same element produces multiple chunks
- Handles reordering: same element in different position still matches
- Handles modifications: text change breaks match (correct behavior)

**Edge Cases Handled:**
- Multiple chunks from same element: text content distinguishes them
- Whitespace-only changes: exact text match required
- Image chunks: element_id sufficient (no text)
- Moved elements: currently show as delete+insert (acceptable for MVP)

**Limitations:**
- Large text changes might not match if element_id changed (rare)
- No fuzzy matching - exact match required
- Move detection not implemented (future enhancement)

#### Transform Pipeline Integration

**Problem:** Need to add diff annotations without breaking existing transforms.

**Solution:** Insert new transforms late in pipeline, after content generation but before boundaries.

```
Existing:    CreateChunks → AddTyping → ImageTruncate → LineWrap → ImageHoverPreview → MarkBoundaries
Added:       CreateChunks → AddTyping → ImageTruncate → LineWrap → ImageHoverPreview → [DiffOverlay] → MarkBoundaries
```

**Rationale:**
- Diff transform needs final chunk elements (requires CreateChunks)
- Must run before MarkBoundaries to avoid conflicting styles
- After LineWrap ensures wrapped chunks get consistent styling
- Stateless transform - only reads data, modifies DOM

**Integration Points:**
- `CodeView.ts` line 58: `state = applyTransform_DiffOverlay(state);`
- `BeforeCodeView.ts` line 64: `state = applyTransform_BeforeDiffOverlay(state);`
- No changes required to other transforms (clean separation)

### Caveats & Trade-offs

#### 1. Independent Folding Controllers

**Trade-off:** Memory overhead of two controller instances vs. state isolation.

**Decision:** Accept overhead for cleaner separation.

**Rationale:**
- Typical prompt sizes are small (hundreds of chunks, not thousands)
- Memory cost negligible compared to benefits of independent state
- Eliminates entire class of synchronization bugs
- Simplifies code significantly

#### 2. Before Panel Initially Hidden

**Trade-off:** Discoverability vs. UI complexity.

**Decision:** Hide by default, make toggle prominent.

**Rationale:**
- Most users start by exploring after (current) state
- Before view is power-user feature for understanding changes
- Reduces visual overwhelm for new users
- One click to show when needed

#### 3. CSS Class Toggle vs. View Swapping

**Trade-off:** Less flexibility vs. better performance.

**Decision:** Use CSS class for toggling overlays.

**Alternatives Considered:**
- Rebuild DOM on toggle: More flexible but slower, loses scroll position
- Swap entire views: Cleaner separation but more complex state management
- Conditional rendering: Would require React-like framework

**Rationale:**
- Performance: Instant toggle with no flicker
- Simplicity: Single line of code to toggle
- Reversibility: Perfect state preservation
- Sufficient for current needs

#### 4. Dual Panel Layout vs. Inline Diffs

**Trade-off:** Horizontal space vs. comprehension.

**Decision:** Separate before/after panels.

**Rationale:**
- User testing showed side-by-side easier to understand
- Deletions make sense in original context
- Independent navigation valuable for large diffs
- Horizontal space available in typical use cases (wide screens, Jupyter)

**When This Breaks Down:**
- Very narrow displays (< 1200px): panels become cramped
- Future: Could add responsive layout that stacks panels vertically

---

## Current Status

### Completed
- ✅ Phase 1: Data Plumbing (Python)
  - `widget_with_diff()` methods on StructuredPrompt and CompiledIR
  - Demo files with diff overlay examples
  - JSON payload with before_prompt_ir, structured_diff, rendered_diff

- ✅ Phase 2: TypeScript Data Layer
  - Extended WidgetData interface
  - Reused existing diff-types structures

- ✅ Before Code View Implementation
  - Complete BeforeCodeView component
  - Independent folding controller
  - Full keyboard navigation and selection support

- ✅ Diff Overlay Transforms
  - beforeDiffOverlay.ts for before view (delete/replace annotations)
  - diffOverlay.ts for after view (insert/replace annotations)
  - Integrated into transform pipelines

- ✅ Container Layout
  - Dual-panel layout (Tree | Before | After | Markdown)
  - State management for before panel visibility
  - CSS-based diff toggle

- ✅ Toolbar Integration
  - Diff metrics display
  - Before view toggle button (with updated icon)
  - Diff toggle button
  - Proper ordering (Before button before Code button)

- ✅ CSS Styling
  - Before panel width allocation (33%)
  - Enhanced delete styling in before panel
  - Diff overlay styles (insert, delete, replace)
  - Dark mode support

### Backward Compatibility
- ✅ Non-diff widgets work identically (no visual changes)
- ✅ All diff UI elements hidden when diff data absent
- ✅ Existing demos and tests unaffected

---

## Next Steps

### Tree View Diff Overlays

**Scope:** Add diff annotations to tree view using `structured_diff` data.

**Planned Features:**
- Status badges next to node labels (+, −, ↷ for added/removed/moved)
- Color-coded left ribbons on tree rows
- Diff metrics in tree header
- Optional: Ghost nodes for deleted sections (grouped under "Removed" parent)

**Challenges:**
- Tree view already has rich styling - need to ensure diff decorations don't conflict
- Ghost nodes require extending tree data model
- Need to handle nested deletions (entire subtrees removed)

### Markdown View Diff Overlays

**Scope:** Add diff annotations to rendered markdown using `rendered_diff` data.

**Planned Features:**
- Inline `<ins>` and `<del>` styling for changed text
- Block-level change indicators for added/removed sections
- Collapsible panels for deleted content
- Preserve markdown semantic structure while showing changes

**Challenges:**
- Markdown rendering happens after compilation - need to map diff spans to rendered elements
- Block-level changes (entire paragraphs, lists) need different treatment than inline
- Must respect markdown structure (can't insert `<del>` mid-table-cell)
- Need to handle code blocks, images, and other special markdown elements

### Polish & Accessibility

**Scope:** Refinements based on user feedback.

**Potential Work:**
- Keyboard shortcuts for toggling before/diff views
- Accessibility: ARIA labels for diff states
- User preference persistence (localStorage for default toggle state)
- Responsive layout for narrow displays
- Performance optimization for large diffs (virtualization?)

### Documentation & Demos

**Scope:** Help users understand and use diff features.

**Planned:**
- Update main documentation with diff feature explanation
- Add screenshots showing before/after/diff states
- Create notebook demo showing realistic diff scenarios
- Document API: how to create widgets with diffs from Python
