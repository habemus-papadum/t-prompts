# Structured Prompt Widget Diff Overlay Plan

## Objectives
- Extend the Structured Prompt widget so it can optionally display rich diff information when provided alongside the current prompt.
- Preserve existing behaviour when diff inputs are absent.
- Offer users an intuitive way to compare the "before" (prior prompt) and "after" (current prompt) states while still being able to focus on the current prompt alone.

## Data Inputs
| Input | Description | Format |
| --- | --- | --- |
| `afterPrompt` | The current compiled IR (status quo input). | JSON IR |
| `beforePrompt` | Prior prompt compiled IR. Optional; only required when diff overlays are active. | JSON IR |
| `structuredDiff` | Machine-friendly diff describing changes at the tree/node level (insert/move/delete). | JSON |
| `renderedDiff` | Render-ready diff (e.g., Markdown/HTML pre-rendered comparisons) that captures deletions and contextual formatting. | JSON |

- The widget will gate diff-related UI behind the presence of both `structuredDiff` and `renderedDiff`. `beforePrompt` is used to hydrate deletions and ensure the diff overlay can fall back if rendered diff lacks detail.

## High-Level Experience
1. **Default View**: When diff inputs are missing, the widget renders exactly as it does today.
2. **Diff Mode Toggle**: When diff inputs exist, the widget exposes a "Diff mode" toggle (defaults to on). Users can toggle off to see the after prompt with no annotations.
3. **Diff Status Summary**: A banner or header chip summarises counts of added, modified/moved, and removed elements. Clicking the summary focuses the tree or chunk views.

## UI Overlay Strategy
### Tree View
- **Node Styling**
  - Added nodes: thick green top & bottom border plus subtle green background tint.
  - Modified nodes: blue accent border and dot indicator next to node title.
  - Moved nodes: orange accent with directional chevron icon.
  - Deleted nodes: shown as "ghost" entries pinned to their former parent group at the bottom with dashed outline and muted red text. Hovering reveals origin path and offers "show context" button that expands the deleted node's children from `beforePrompt`.
- **Keyboard Navigation**: Ensure diff badges are accessible and ARIA labelled (e.g., `aria-label="Added chunk"`).

### Chunk / Code View
- Each chunk remains vertically stacked as today.
- **Additions**: Use a thick green strip along the top & bottom edges, matching idea from prompt. Add `+` badge in the header line.
- **Deletions**: Render inline ghost blocks using the rendered diff fragment; appear collapsed by default with a pill labelled "Show removed". Upon expansion they show the deleted code with red tinted background and strikethrough.
- **Modifications**: Combine addition/deletion semantics at the granular line level by leveraging `renderedDiff` spans. Highlight replaced lines using side-by-side inline diff (two-column layout within the chunk), showing before (red) and after (green) panels.
- **Moved Chunks**: Show draggable-style handle icon and label "Moved from section X" derived from diff metadata.

### Markdown / Rich Text View
- Use inline diff markers generated from `renderedDiff` (e.g., `diff` AST with `add`/`del` nodes).
- Added sentences/blocks receive green left border; deleted items appear as callout boxes with dashed red border and grey background, optionally collapsible.
- Provide tooltip explaining modifications when hovering over highlighted text segments.

### Global Interaction Enhancements
- **Diff Navigator**: Introduce a compact sidebar list of diff events allowing users to jump to next/previous change.
- **Legend**: Provide legend describing colour/border semantics, ensuring accessibility (WCAG contrast) with text labels and shapes, not just colour.
- **Persistence**: Store diff toggle state in local widget state (no persistence across sessions needed).

## Data Flow & State Management
1. Extend widget props to include optional `beforePrompt`, `structuredDiff`, and `renderedDiff`.
2. Introduce derived `diffAvailable` flag computed in the widget.
3. Build selectors/transforms that map diff data to tree and chunk overlays:
   - `indexBeforePrompt` to map node IDs to their content for quick ghost rendering.
   - `mergeDiffIntoTree(afterTree, structuredDiff)` producing augmented nodes with status markers.
   - `buildChunkDiffs(afterChunks, renderedDiff)` returning overlay metadata for each chunk (additions/deletions/replacements/moves).
4. Guard render layers with diff toggle so overlays only mount when `diffMode === true`.

## Accessibility Considerations
- Provide text alternatives for colour-coded states (e.g., icons with `aria-label` text, `sr-only` descriptions).
- Ensure focus order includes diff toggles and ghost nodes.
- Respect reduced motion by avoiding animated transitions beyond simple fades.

## Implementation Steps
1. **Prop & Data Layer Updates**
   - Update `StructuredPromptWidgetProps` TypeScript interface to accept new optional inputs.
   - Adjust widget entry point to pass through data.
   - Create utility functions for diff merging and fallback when diff data is partial.
2. **State & Toggle**
   - Add React state `diffModeEnabled` defaulting to `true` when diff data present.
   - Render toggle control with descriptive tooltip.
3. **Tree View Enhancements**
   - Extend tree node rendering components to accept diff metadata (status enums, ghost nodes).
   - Render ghost nodes using `beforePrompt` data when deletion diff encountered.
   - Implement badge/legend components.
4. **Chunk/Code View Enhancements**
   - Update chunk renderer to accept overlay metadata.
   - Implement collapsible deleted blocks and side-by-side replacements using CSS grid.
5. **Markdown View Enhancements**
   - Parse rendered diff fragments into React elements with custom styling wrappers.
   - Ensure fallback when diff fragment missing -> default to current view.
6. **Navigation & Summary**
   - Build diff summary header (counts aggregated from diff metadata).
   - Optionally create a simple navigator component; highlight currently viewed diff section by observing scroll position.
7. **Testing**
   - Add unit tests for new diff utility functions.
   - Add snapshot/DOM tests covering diff overlays in tree and chunk views.
   - Ensure existing tests still pass when diff inputs omitted.
8. **Documentation**
   - Update widget README/docs describing diff mode, toggle, and data contract.

## Open Questions & Future Enhancements
- Whether to support inline editing based on diff context (out of scope now).
- Potential to infer `beforePrompt` solely from diffs; keeping direct input simplifies initial implementation.
- Consider exposing API for custom diff styling themes.
