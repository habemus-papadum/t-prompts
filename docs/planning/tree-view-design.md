# TreeView Component Design

## Overview

The TreeView provides a hierarchical visualization of prompt elements with visibility metrics and interactive folding controls. It displays the element tree structure (not chunks), allowing users to understand composition and control visibility at the element level.

## Visual Design

### Aesthetic Principles

- **Minimal and Text-Centric**: Focus on typography and simple geometric shapes
- **Modern and Clean**: Avoid dated UI patterns (no 1990s Java look)
- **Responsive**: Graceful collapse/expand with smooth transitions
- **Subtle Indicators**: Small triangles for expand/collapse, minimal chrome

### Layout Structure

```
┌──────────────────────────────────────────────┐
│ Toolbar                                      │
├──────────────────────────────────────────────┤
│ TreeView │ Code/Markdown View                │
│ (Collapsible)                                │
│                                               │
│ ▾ Root                                        │
│   ▾ ▪ static: "Analyze..."  ⬤ 450/500ch     │
│     ▸ ▣ nested: "helper"    ⬤ 200/250ch     │
│     • ◆ interp: "query"     ⬤ 50/100ch      │
│                                               │
└──────────────────────────────────────────────┘
```

### TreeView States

**Expanded (default):**
```
┌─────────────────┬──────────────────┐
│ TreeView        │  Code View       │
│ 250px-400px     │  Flex            │
└─────────────────┴──────────────────┘
```

**Collapsed:**
```
┌┬─────────────────────────────┐
││  Code View (full width)     │
│▸                             │
└┴─────────────────────────────┘
```

The collapsed state shows a minimal 12px sidebar with a centered triangle indicator.

### Collapse/Expand Controls

**Panel Expand Control (when collapsed):**
- 12px wide vertical strip on left edge
- Small triangle `▸` centered vertically
- Hover: subtle background highlight
- Click: expands TreeView with smooth slide-in animation

**Panel Collapse Control (when expanded):**
- Located in TreeView header/toolbar area
- Icon button with collapse chevron `«` or `⮜`
- Tooltip: "Hide tree view"
- Click: collapses TreeView to minimal sidebar

**Tree Node Expand/Collapse:**
- Triangle indicators: `▸` (collapsed), `▾` (expanded)
- 8px spacing before element icon
- Click anywhere on the item to toggle node expansion
- Smooth height transition on expand/collapse

## TreeView Item Structure

Each tree item displays:

```
[△] [Icon] Key Text (elided)  [VisibilityMeter]
 ↑    ↑     ↑                  ↑
 │    │     │                  └─ Pie chart + text (from VisibilityMeter component)
 │    │     └─ Element key, max 15 chars, elided with …
 │    └─ Unicode icon for element type
 └─ Expand/collapse triangle (if has children)
```

### Element Type Icons

**Geometric Unicode Icons:**

| Element Type    | Unicode | Rationale                                |
|-----------------|---------|------------------------------------------|
| `static`        | `▪`     | Solid square - baseline/foundation       |
| `interpolation` | `◆`     | Diamond - dynamic data                   |
| `nested_prompt` | `▣`     | Boxed square - composition/containment   |
| `list`          | `≡`     | Triple bar - stacked items               |
| `image`         | `▢`     | Square frame - picture frame             |
| `unknown`       | `?`     | Question mark - uncertain type           |

These geometric icons provide a clean, minimal aesthetic that scales well and works in all environments.

### Key Text Elision

- Maximum 15 characters displayed
- Elided with `…` if longer
- Examples:
  - `"Analyze this"` → `Analyze this`
  - `"Very long static text here"` → `Very long stat…`
  - Numeric keys: `0`, `1`, `2` (no elision needed)

### Visibility Meter Integration

**Use existing `VisibilityMeter` component** from `src/components/VisibilityMeter.ts`:

```typescript
import { createVisibilityMeter } from './VisibilityMeter';

// For each tree item:
const meter = createVisibilityMeter({
  totalCharacters: elementTotalChars,
  totalPixels: elementTotalPixels,
  showCharacterText: true,
  showPixelText: elementTotalPixels > 0, // Only show pixels if element has images
  showCharacterPie: true,
  showPixelPie: elementTotalPixels > 0,
});

// Update when folding state changes:
meter.update(visibleCharacters, visiblePixels);
```

The VisibilityMeter component handles:
- Pie chart visualization (SVG circles)
- Text formatting with magnitude suffixes (k, M, B, T)
- Automatic hiding of pixel metrics when total is 0
- Color coding (blue for characters, orange for pixels)

## Interaction Design

### Click Behavior

**Single-click on tree item:** Toggle node expansion (show/hide children)
- Provides simple, intuitive tree navigation
- Smooth height transitions for expand/collapse animations

### Double-Click Behavior

**Goal:** Toggle element visibility by collapsing/expanding all chunks in the element.

**Logic:**

1. **Check current visibility state:**
   - Iterate through all chunk IDs belonging to the element
   - Check if any chunk is currently visible (not collapsed)

2. **If any chunks are visible:**
   - **Action:** Collapse all chunks in the element
   - **Implementation:** Call `foldingController.collapseChunks(chunkIds)`

3. **If all chunks are hidden:**
   - **Action:** Expand all chunks in the element
   - **Implementation:** Call `foldingController.expandByChunkIds(chunkIds)` (new method)

### Visual Feedback

- **Hover**: Subtle background highlight on tree item
- **Active (during double-click)**: Brief flash/pulse animation
- **State change**: Visibility meter updates smoothly
- **Collapsed → Expanded**: Fade-in transition for meter

## Data Model

### Input Data (from WidgetData)

```typescript
interface ElementTreeNode {
  id: string;                    // Element ID
  type: string;                  // Element type (static, interpolation, etc.)
  key: string | number;          // Element key
  children?: ElementTreeNode[];  // Child elements
  chunkIds: string[];            // Chunk IDs belonging to this element
}
```

### Computed Data

```typescript
interface ElementVisibility {
  elementId: string;
  visibleCharacters: number;
  totalCharacters: number;
  visiblePixels: number;
  totalPixels: number;
  isFullyVisible: boolean;
  isFullyHidden: boolean;
}
```

### Building the Tree

**Algorithm:**

1. Start with `WidgetData.source_prompt.children`
2. For each element node:
   - Extract `id`, `type`, `key`, `children`
   - Find all chunks with `chunk.element_id === element.id`
   - Store chunk IDs for later visibility computation
   - Compute total characters and pixels from chunk sizes
3. Recursively process child elements
4. Result: Tree structure with chunk ID mapping and totals

**Default State:** All tree nodes start **fully expanded**.

## Controller API Changes

### New Method: `expandByChunkIds`

**Purpose:** Expand collapsed nodes that contain any of the specified chunk IDs.

**Signature:**
```typescript
expandByChunkIds(targetChunkIds: string[]): void
```

**Algorithm:**

1. Traverse the collapsed chunks tree (depth-first)
2. For each leaf collapsed chunk node:
   - Check if `node.chunkIds` overlaps with `targetChunkIds`
   - If overlap exists: Expand node, Emit `FoldingEvent` expanded chunk
3. Continue traversal (be careful as the expansion will have mutated the tree (but not in that makes continuation impossible))
4. Multiple expansion notifications may be emitted -- we are not trying to optimize that away

**Overlap Check:**
```typescript
function hasOverlap(nodeChunkIds: string[], targetChunkIds: string[]): boolean {
  return nodeChunkIds.some(id => targetChunkIds.includes(id));
}
```
NOTE:  The above should actually use Sets note string[]

**Example:**

```
Collapsed State:
  A [chunks: 1,2,3]
  ├─ B [chunks: 1,2]
  └─ C [chunks: 3]

expandByChunkIds(['1', '2'])
  → Finds overlap in B
  → Expands B
  → Checks if A should expand (still has C collapsed)
  → Result: B expanded, A partially expanded
```

### Existing Methods Used

- `isCollapsed(chunkId)`: Check if chunk is collapsed
- `collapseChunks(chunkIds)`: Collapse multiple chunks
- `addClient(client)`: Register for fold events
- `removeClient(client)`: Unregister client

## Component Architecture

### TreeView Component

```typescript
interface TreeView extends Component {
  element: HTMLElement;           // Root <div> container
  update(): void;                 // Recompute visibility and update UI
  destroy(): void;                // Cleanup
}

interface TreeViewOptions {
  data: WidgetData;
  metadata: WidgetMetadata;
  foldingController: FoldingController;
}

function buildTreeView(
  data: WidgetData,
  metadata: WidgetMetadata,
  foldingController: FoldingController
): TreeView;
```

### Tree Item Component

```typescript
interface TreeItemComponent {
  element: HTMLElement;           // Tree item <div>
  node: ElementTreeNode;          // Element data
  visibilityMeter: VisibilityMeter; // Meter component instance
  children: TreeItemComponent[];  // Child items
  expanded: boolean;              // Expansion state (starts true)

  toggle(): void;                 // Toggle expansion
  updateVisibility(): void;       // Update meter
}
```

### Component Hierarchy

```
TreeView
├─ Header (collapse button)
├─ Tree Items Container (scrollable)
│  └─ TreeItemComponent (root, expanded by default)
│     ├─ Expand Triangle
│     ├─ Type Icon
│     ├─ Key Text
│     ├─ VisibilityMeter.element
│     └─ Children Container
│        ├─ TreeItemComponent (child 1, expanded)
│        ├─ TreeItemComponent (child 2, expanded)
│        └─ ...
└─ Footer (optional: total visible/total summary)
```

## Implementation Plan

### Phase 1: Core Structure
1. Create `TreeView.ts` component
2. Build element tree from `WidgetData.source_prompt.children`
3. Map chunks to elements using `chunk.element_id`
4. Implement basic rendering (tree structure with icons and keys)
5. Add expand/collapse interaction for tree nodes (starts expanded)

### Phase 2: Visibility Integration
1. Compute element → chunk mapping
2. Compute total characters/pixels per element from `metadata.chunkSizeMap`
3. Integrate `VisibilityMeter` component for each tree item
4. Subscribe to `FoldingController` events
5. Update visibility meters on fold state changes
6. Compute visible counts by checking `isCollapsed()` for each chunk

### Phase 3: Controller Enhancement
1. Implement `expandByChunkIds` method in `FoldingController`
2. Add overlap checking logic
3. Add bubble-up expansion logic
4. Test with nested structures
5. Wire up double-click behavior in TreeView

### Phase 4: Panel Collapsing
1. Add panel collapse/expand controls
2. Implement slide-in/out animations (CSS transitions)
3. Add responsive breakpoints
4. Persist collapsed state in sessionStorage

### Phase 5: Polish
1. Add keyboard navigation (arrow keys, space, enter)
2. Implement smooth transitions for visibility updates
3. Add accessibility attributes (ARIA tree roles)
4. Performance optimization for large trees (>1000 nodes)
5. Add loading skeleton for async tree building

## Styling Guidelines

### CSS Variables

```css
--tp-tree-indent: 16px;              /* Indentation per level */
--tp-tree-item-height: 28px;         /* Height of each item */
--tp-tree-icon-size: 14px;           /* Size of type icon */
--tp-tree-width-min: 250px;          /* Min width when expanded */
--tp-tree-width-max: 400px;          /* Max width when expanded */
--tp-tree-width-collapsed: 12px;     /* Width when collapsed */
--tp-tree-transition: 0.2s ease;     /* Animation duration */
```

### Class Names

```css
.tp-tree-view                 /* Root container */
.tp-tree-header               /* Header with collapse button */
.tp-tree-items                /* Scrollable items container */
.tp-tree-item                 /* Individual tree item */
.tp-tree-item--expanded       /* Expanded item state */
.tp-tree-item--collapsed      /* Collapsed item state */
.tp-tree-toggle               /* Expand/collapse triangle */
.tp-tree-icon                 /* Type icon */
.tp-tree-icon--static         /* Type-specific icon class */
.tp-tree-icon--interpolation  /* Type-specific icon class */
.tp-tree-icon--nested_prompt  /* Type-specific icon class */
.tp-tree-icon--list           /* Type-specific icon class */
.tp-tree-icon--image          /* Type-specific icon class */
.tp-tree-icon--unknown        /* Type-specific icon class */
.tp-tree-key                  /* Key text */
.tp-tree-meter                /* Wrapper for visibility meter */
.tp-tree-children             /* Children container */
.tp-tree-panel-collapsed      /* Collapsed panel state */
.tp-tree-expand-strip         /* Minimal expand control (12px) */
```

### Dark Mode Considerations

- Use semantic color tokens from existing system
- Triangle indicators: `var(--tp-color-muted)`
- Hover states: `var(--tp-color-accent)`
- Type icons: Use element type hues (from CSS variables)
- Backgrounds: `var(--tp-color-bg)` with subtle borders
- VisibilityMeter already supports dark mode

## Accessibility

- **Keyboard Navigation:**
  - Arrow Up/Down: Navigate between tree items
  - Arrow Right: Expand current item (if collapsed)
  - Arrow Left: Collapse current item (if expanded)
  - Space/Enter: Toggle expansion
  - Home: Jump to first item
  - End: Jump to last visible item

- **ARIA Attributes:**
  - `role="tree"` on container
  - `role="treeitem"` on items
  - `aria-expanded="true|false"` on expandable items
  - `aria-level="{depth}"` for nesting level (1-indexed)
  - `aria-label` for icons
  - `aria-label` for meters (already handled by VisibilityMeter)

- **Screen Reader Support:**
  - Announce element type, key, and visibility on focus
  - Announce expansion state changes
  - Provide text alternatives for icons
  - Example: "Static element, key: 'Analyze', 450 of 500 characters visible, expanded, level 1"

## Integration with Widget Container

### Layout Changes

Update the content area to support TreeView:

```typescript
// Before (CodeView and MarkdownView only):
.tp-content-area {
  display: flex;
}

// After (TreeView + CodeView/MarkdownView):
.tp-content-area {
  display: flex;
  flex-direction: row;
}

.tp-tree-panel {
  flex: 0 0 auto;
  width: var(--tp-tree-width-min);
  max-width: var(--tp-tree-width-max);
  border-right: 1px solid var(--tp-color-border);
  overflow-y: auto;
  resize: horizontal; /* Allow user to resize */
}

.tp-tree-panel--collapsed {
  width: var(--tp-tree-width-collapsed);
  resize: none;
}

.tp-view-panels {
  flex: 1;
  display: flex;
  min-width: 0;
}
```

### Widget Container Updates

```typescript
// In WidgetContainer.ts:

interface WidgetContainer {
  // ...existing fields...
  treeView: TreeView | null;
  treePanel: HTMLElement;
  treeExpanded: boolean;
}

function buildWidgetContainer(...): WidgetContainer {
  // ...existing code...

  // Build TreeView
  const treeView = buildTreeView(data, metadata, foldingController);
  const treePanel = document.createElement('div');
  treePanel.className = 'tp-tree-panel';
  treePanel.appendChild(treeView.element);

  // Insert before existing panels
  contentArea.insertBefore(treePanel, contentArea.firstChild);

  // Add collapse/expand handlers
  // ...
}
```

## Implementation Report

- ✅ **Tree construction & UI**: Implemented the hierarchical renderer in `TreeView.ts` with thorough unit coverage. Elements display type icons, elided keys, nested indentation, and respond to single-click toggles exactly as specified.
- ✅ **Visibility metrics**: Integrated the existing `VisibilityMeter` component so every node reports total/visible character and pixel counts (aggregated across descendants). The meter updates automatically on controller events.
- ✅ **Folding controller support**: Added a recursive `expandByChunkIds` API to `FoldingController`, with tests covering nested collapses and partial overlaps.
- ✅ **Double-click behaviour**: Double-clicking a tree row collapses (or expands) all associated chunks. Because the controller lacks a direct `collapseChunks` helper, the implementation reuses `selectByIds` + `commitSelections()` to achieve the same result—documenting this minor deviation from the original plan.
- ✅ **Panel collapsing**: The widget container now hosts the tree panel with a header collapse button, 12 px expand strip, slide-in transitions, and sessionStorage-backed persistence. Associated layout styles/tests were updated.
- 🔄 **Deferred polish**: Keyboard navigation, animated meter transitions, and large-tree optimisations remain future work items and are tracked separately.

## Future Enhancements

- **Search/Filter:** Filter tree by element type, key, or visibility
- **Sorting:** Sort children by key, type, or visibility percentage
- **Context Menu:** Right-click options (collapse all, expand all, copy path)
- **Breadcrumb Trail:** Show path from root to selected item
- **Selection Sync:** Select element → highlight in code view
- **Virtual Scrolling:** For trees with >10,000 nodes
- **Export:** Export tree structure as JSON or text outline
- **Tree Diff:** Compare two trees side-by-side

---

**Status:** Design documentation complete and updated with user feedback.

**Key Decisions:**
- ✅ Tree starts fully expanded by default
- ✅ Use geometric Unicode icons (▪, ◆, ▣, ≡, ▢, ?)
- ✅ Use existing VisibilityMeter component
- ✅ Single-click toggles expansion only (no selection)
