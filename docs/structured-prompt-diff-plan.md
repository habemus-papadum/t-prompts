# Structured Prompt Widget Diff Overlay Plan

## Goals
- Extend the existing Structured Prompt widget so that, when diff metadata is available, the UI can show how the current prompt ("after") differs from a prior prompt ("before").
- Preserve current behavior when diff metadata is absent.
- Provide a user-controlled toggle that overlays diff styling in all relevant views (tree, code chunks, markdown preview).
- Surface both structural (tree) and textual (rendered diff) changes without overwhelming the current layout.

## New Data Inputs
The widget already receives JSON describing the compiled IR of the "after" prompt. We will add optional diff payloads that are emitted alongside the existing widget JSON:

| Field | Type | Description |
| --- | --- | --- |
| `prior_compiled_ir` | `CompiledIRJSON \| null` | Serialized IR for the "before" prompt. Mirrors `compiled_ir` schema. |
| `structured_diff` | `StructuredPromptDiffData \| null` | JSON produced by `StructuredPromptDiff.to_json()`. Mirrors the data shape already used by `StructuredPromptDiffView`. |
| `rendered_diff` | `RenderedPromptDiffData \| null` | JSON produced by `RenderedPromptDiff.to_json()`. Includes chunk-level spans and textual diffs. |

The renderer can assume that when one of these fields is populated, all are populated and internally consistent.

### TypeScript updates
- Extend `WidgetData` in `widgets/src/types.ts` with the optional fields above.
- Update the runtime parser in `widgets/src/renderer.ts` to detect the enriched payload and store it in the widget container state.
- Introduce a `DiffState` helper module that tracks:
  - Whether diff overlay is enabled.
  - Lookup tables for additions/removals/moves keyed by chunk ID and tree node ID.
  - A quick mapping from rendered diff spans to chunk offsets for highlighting.

## UI Behavior Summary
When diff data is available and overlay mode is active:
1. **Toolbar** gains a toggle button labeled "Show diff" with tooltip/ARIA state.
2. **Tree view** highlights nodes that were added, removed, modified, or moved.
3. **Code view** overlays inline markers for added/removed spans and draws borders around newly added chunks.
4. **Markdown view** shows rendered text with inline insert/delete styling similar to GitHub's review UI.
5. **Deleted-only content** (nodes or chunks present in "before" but not "after") appears in a collapsible "Removed items" panel pinned below the existing content.

Turning the toggle off restores the current pristine presentation, with all diff affordances hidden.

## Detailed View Design

### Toolbar integration
- Extend `Toolbar` state with a new button. Clicking toggles `diffState.enabled` and dispatches a custom `tp:diff-toggle` event.
- Store the last-used choice in `sessionStorage` per IR ID so reloading a notebook preserves the preference.
- When diff is unavailable, hide or disable the button and show a tooltip explaining that diff data is missing.

### Tree view overlay
- Augment `TreeView` props with `diffState`.
- During tree rendering:
  - Nodes added in "after" get a thick green top/bottom border (`.tp-diff-node--added`).
  - Modified nodes retain their base background but receive a colored left accent bar (`--tp-diff-modified`).
  - Moved nodes add a dashed outline and index tooltip (`title="Moved from 3"`).
  - Deleted nodes are rendered as "ghost" entries: semi-transparent rows appended to a "Removed items" section at the bottom of the tree, grouped by parent path. Clicking a ghost node scrolls the Markdown/Code view to the closest surviving sibling.
- Tree folding respects diff markers: collapsing a parent hides child highlights but keeps the parent badge that displays counts (e.g., `+2 | −1`).
- Add keyboard-accessible focus states consistent with new styling.

### Code view overlay
- Use `rendered_diff` to build per-chunk annotations:
  - For each chunk, compute inline spans for insert/delete segments and wrap them with `<mark>` elements styled via CSS classes (`tp-chunk-ins`, `tp-chunk-del`).
  - Add a green double-border on the chunk container when the entire chunk is new. If the chunk existed but changed, apply a subtle left gradient to avoid conflict with existing backgrounds.
- For deletions that no longer correspond to a visible chunk, add collapsible "Removed chunk" blocks beneath the chunk list. Each block shows the old text with red-tinted background.
- Integrate with `FoldingController` so collapsing a chunk hides its diff decorations.
- Ensure scroll-sync still works by basing offsets on the existing chunk DOM structure.

### Markdown view overlay
- Render the "after" markdown as today.
- Overlay diff by injecting `<ins>`/`<del>` tags following the rendered diff ranges. CSS rules provide green underline for insertions and red strikethrough for deletions.
- Provide a floating legend (similar to keyboard shortcuts overlay) that appears when diff mode is toggled on, describing the color conventions.
- For deleted markdown blocks, show them in a dedicated "Removed sections" accordion beneath the main preview, using collapsible `<details>` to avoid clutter.

### Deleted content staging area
- Create a shared component `RemovedItemsPanel` mounted after the main content area.
- Accepts both tree-node ghosts and chunk/markdown deletions, presenting them in tabs:
  - "Structure" tab lists deleted nodes grouped by parent.
  - "Rendered" tab lists removed rendered spans with context.
- Each entry includes an action to copy the removed text.
- The panel is hidden entirely when overlay is off or when there are no deletions.

## Data Flow & State Management
1. `buildWidgetContainer` receives `diffState`. The state exposes getters for per-chunk/per-node statuses.
2. Child views subscribe to the `tp:diff-toggle` event dispatched on the root element and re-render their diff decorations when the flag changes.
3. To avoid expensive full re-renders, diff decorations are implemented as class toggles and prebuilt DOM fragments appended once during initialization.
4. Introduce utility functions in `widgets/src/utils/diffDecorators.ts`:
   - `applyNodeDiffState(element, nodeDiff)`
   - `renderDeletedNodeGhost(nodeDiff)`
   - `applyChunkDiffState(chunkElement, chunkDiff)`
   - `decorateMarkdownFragment(root, diffRanges)`

## Accessibility & UX Considerations
- Ensure color choices meet WCAG contrast guidelines; provide patterns (dashed borders) in addition to color.
- Add `aria-live="polite"` announcements when diff mode toggles, e.g., "Diff annotations enabled".
- Keyboard focus order must include the diff toggle and any newly inserted panels.
- Provide tooltips for diff legends and ghost nodes describing their meaning.

## Testing Strategy
- Unit tests (Vitest) covering:
  - Toolbar toggle state and event dispatch.
  - Tree view class assignments for added/removed/moved nodes.
  - Code view span wrapping using sample diff payloads.
  - Markdown overlay output (ins/del tags).
- Snapshot tests for the mock HTML fragments to detect styling regressions.
- Manual testing checklist in docs for verifying toggles, persistence, and absence of overlay when data is missing.

## Incremental Implementation Steps
1. **Schema & plumbing**
   - Update JSON schema types and renderer to accept optional diff payloads.
   - Build `DiffState` helper with parsing logic.
2. **Toolbar toggle**
   - Add button, event wiring, and persistence.
3. **Tree view integration**
   - Apply node class toggles; add removed-items ghost section.
4. **Code view integration**
   - Wrap text spans and chunk borders; handle deleted chunks list.
5. **Markdown integration**
   - Implement ins/del overlay and removed sections accordion.
6. **Removed items panel**
   - Aggregate deleted elements and render panel below main layout.
7. **Styling & accessibility**
   - Define CSS variables for diff colors/borders; ensure focus states.
8. **Testing & docs**
   - Add unit tests, update documentation, and include mock HTML for reference.

## Open Questions
- Should diff overlay be partially applied (e.g., only tree) if one data source is missing? Current plan assumes all-or-nothing overlay.
- How should performance behave for very large diffs? We may need virtualization if the diff view becomes heavy.
- Does the removed items panel belong inside the widget or in a separate tab? The plan embeds it for quicker discovery.
