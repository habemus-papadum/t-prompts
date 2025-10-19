# Scroll Synchronization Design

This document records the design for keeping the CodeView and MarkdownView scroll positions in sync. It was adapted from the design discussion carried out before implementation and is intended to guide future maintenance.

## Goals

- Mirror vertical scroll positions between the CodeView and the MarkdownView so that the same logical chunk is visible in both panes.
- Preserve stability while chunks are folded/unfolded, assets load asynchronously, or layout changes occur.
- Allow users to temporarily disable scroll synchronization via the toolbar.

## Core Data Structures

### `ChunkLayoutCache`

For each scrollable surface we maintain a cache that maps chunk IDs to measurable DOM nodes and their layout metrics:

```
interface ChunkLayoutEntry {
  chunkId: string;
  anchors: HTMLElement[];    // Stable nodes that represent the chunk
  rects: DOMRectReadOnly[];  // Client rects for every anchor
  top: number;               // Top position relative to the scroll container
  bottom: number;            // Bottom position relative to the scroll container
  height: number;            // bottom - top, clamped to ≥ 1px
  isCollapsed: boolean;      // Whether the chunk is collapsed in this view
}

interface ChunkLayoutCache {
  entries: ChunkLayoutEntry[]; // Sorted in visible chunk order
  byId: Map<string, ChunkLayoutEntry>;
  totalHeight: number;         // Sum of `height` across entries
  timestamp: number;           // Last rebuild time
}
```

Entries are ordered using `foldingController.getVisibleSequence()` so that we can binary-search by scroll offset. Each entry aggregates the union of DOMRects returned by `getClientRects()` for all anchor nodes, ensuring multi-line inline chunks are measured correctly.

### `ScrollSyncManager`

A controller that lives alongside the views within `WidgetContainer`:

```
interface ScrollSyncManager {
  caches: {
    code: ChunkLayoutCache;
    markdown: ChunkLayoutCache;
  };
  activeSource: 'code' | 'markdown' | null;
  pendingRecalc: number | null;
  observe(): void;
  destroy(): void;
}
```

The manager attaches scroll listeners to both panes, debounces layout recomputation, and exposes `markDirty(reason)` so view logic (folding handlers, asset load events, etc.) can schedule cache refreshes.

## Keeping the Layout Cache Fresh

1. **Initial build** – Once the widget constructs both views, `ScrollSyncManager.observe()` builds caches using the current visible sequence. Chunk-specific marker nodes are inserted only if necessary so later mutations always leave a measurable anchor in the DOM.
2. **Folding events** – The manager registers as a `FoldingClient`. Whenever chunks collapse or expand it waits for the view updates to settle, marks the caches dirty, and rebuilds them on the next animation frame.
3. **Layout mutations** – A throttled `ResizeObserver` watches for container size changes. A light `MutationObserver` keeps an eye on structural DOM shifts (wrap containers, collapsed indicators) and requests cache rebuilds.
4. **Asset load** – Images and other late-loading assets register a one-off `load` listener that flags the cache as dirty because they change the rendered height.
5. **Debounce strategy** – Multiple dirty signals are coalesced and caches are recomputed during the next animation frame to avoid redundant measurement passes.

## Scroll Synchronization Algorithm

1. **Detect source scroll** – Scroll listeners set `activeSource` to the pane being scrolled (code or markdown) and ignore reciprocal scroll events until the frame completes. This prevents infinite feedback loops.
2. **Read position** – Using the source cache, the manager finds the chunk entry that contains the current `scrollTop`. If the entry has negligible height (collapsed marker), it walks forward or backward to find a measurable neighbor.
3. **Compute logical progress** – `chunkProgress = clamp((scrollTop - entry.top) / entry.height, 0, 1)` expresses where the viewport sits within the chunk. We also track the cumulative height preceding the chunk to maintain consistent progress across large layout differences.
4. **Map to target view** – The same chunk ID is looked up in the target cache. If missing (e.g., Markdown omits a synthetic collapsed ID), the manager falls back to the first descendant chunk with a measurement. The target scroll position is computed as `targetTop = targetEntry.top + chunkProgress * targetEntry.height`.
5. **Apply scroll** – The target container’s `scrollTop` is updated inside `requestAnimationFrame`. Programmatic scrolls are flagged so their listeners ignore the resulting events.
6. **Optional smoothing** – When the panes diverge drastically in total height the manager blends toward the target offset to reduce jitter.

## Collapse/Expand Handling

- **CodeView** replaces collapsed children with a synthetic span that reuses the container’s chunk ID. This span becomes the anchor measured in the cache.
- **MarkdownView** hides collapsed elements and inserts inline/block indicators. The manager prefers the indicator as the measurement anchor when a chunk is collapsed so its height reflects the visible marker.
- When collapse state changes, both views recompute their DOM and notify the manager via `markDirty('folding')`, triggering a cache rebuild.

## Edge Cases & Fallbacks

- **Inline mixing** – Aggregating `getClientRects()` captures multi-line inline spans so the measured height matches the actual wrapped layout.
- **Zero-height ranges** – Collapsed indicators can have zero height. Heights are clamped to at least 1px so cumulative offsets always advance.
- **Hidden view modes** – If a pane is hidden (e.g., code-only view) the manager skips syncing toward it until it becomes visible again.
- **Viewport resizing mid-scroll** – Resizes invalidate caches and the manager reapplies the most recent logical position to keep panes aligned.
- **Missing chunk IDs** – When a chunk is absent in the target cache, the manager looks for descendants through `foldingController.getCollapsedChunk()` and falls back to the nearest measurable neighbor.

## Implementation Plan

1. **Augment the views** – Extend CodeView and MarkdownView so the scroll manager can ask each one for measurement anchors per chunk, including collapsed indicators in Markdown.
2. **Implement `ScrollSyncManager`** – Create a dedicated component that builds caches, listens for scroll events, observes layout changes, and exposes `setEnabled` and `markDirty` controls.
3. **Integrate with `WidgetContainer`** – Instantiate the manager alongside the views, ensure folding/resize/mutation events mark caches as dirty, and add cleanup paths.
4. **Toolbar interaction** – Add a toolbar toggle button (left-most icon) that enables or disables scroll synchronization by calling into the manager.
5. **Testing** – Write JSDOM-based unit tests that cover cache building, scroll mirroring, collapse handling, and toolbar toggling.
