# Scroll Synchronization Design

This document summarizes the design for synchronizing scrolling between the CodeView and MarkdownView widgets. The goal is to keep both panes aligned on the same logical chunk as the user scrolls while respecting folding/collapsing state.

## Design Goals

- Provide a smooth scrolling experience that mirrors the relative position between CodeView and MarkdownView.
- Reuse existing data structures (chunk mappings, folding controller) to avoid duplicating state.
- Remain resilient to dynamic layout changes such as folding, image loading, or container resizing.
- Allow the user to temporarily disable synchronization from the toolbar.

## Core Data Structures

### ChunkLayoutCache

Each scrollable view maintains a cache of measured layout information for the currently visible chunk sequence. The cache is keyed by chunk ID and contains a sorted array for binary search.

```
interface ChunkLayoutEntry {
  chunkId: string;
  anchors: HTMLElement[];   // DOM nodes representing the chunk
  top: number;               // Offset from the top of the scroll container
  bottom: number;            // Offset to the bottom of the chunk
  height: number;            // bottom - top (clamped to ≥ 1px)
  isCollapsed: boolean;
  startOffset: number;       // Sum of heights for preceding entries
}
```

```
type ChunkLayoutCache = {
  entries: ChunkLayoutEntry[];      // Sorted by visible sequence order
  byId: Map<string, ChunkLayoutEntry>;
  totalHeight: number;
  timestamp: number;                // For debugging/telemetry
};
```

`entries` is sorted according to `foldingController.getVisibleSequence()`, enabling efficient lookups by scroll position. The cache is rebuilt whenever the layout might change.

### ScrollSyncManager

A controller mounted by `WidgetContainer` that orchestrates measurement and scroll mirroring between both panes.

```
interface ScrollSyncManager {
  observe(): void;
  destroy(): void;
  setEnabled(enabled: boolean): void;
  markDirty(reason: string): void;
}
```

The manager stores two caches (`code` and `markdown`), tracks the active scroll source to prevent feedback loops, and provides a `markDirty` API for other components to trigger cache rebuilds.

## Keeping the Layout Cache Fresh

1. **Initial build** – After constructing both views, `ScrollSyncManager.observe()` collects the current visible sequence and measures anchors. Collapsed markers reuse the same chunk IDs, so they integrate seamlessly.
2. **Folding events** – The manager registers as a `FoldingClient`. When chunks collapse or expand, the manager rebuilds caches once the corresponding DOM mutations are complete.
3. **Layout mutations** – A `ResizeObserver` watches each scroll container, while a throttled `MutationObserver` listens for structural changes that might move chunks (line wrapping, image toggles, etc.). Both observers call `markDirty`.
4. **Asset loading** – Images inside either view register one-time `load` handlers that call `markDirty` because late sizing can influence scroll offsets.
5. **Debouncing** – `markDirty` batches rebuild requests to the next animation frame, so multiple mutations coalesce into a single measurement pass.

## Scroll Synchronization Algorithm

1. **Detect source scroll** – Scroll listeners set an `activeSource` guard to avoid circular updates. While one pane is the active scroller, the other ignores events triggered by programmatic adjustments.
2. **Read position** – Using the source cache, locate the entry whose range contains the current `scrollTop` (binary search over `entries`). If the entry’s height is zero, skip to the next measurable chunk in the scroll direction.
3. **Compute logical progress** – Calculate `chunkProgress = clamp((scrollTop - entry.top) / entry.height, 0, 1)` and derive `relativeOffset = entry.startOffset + chunkProgress * entry.height` for global progress along the visible sequence.
4. **Map to target view** – Look up the same chunk ID in the target cache. If it is missing (possible for synthetic collapsed IDs), use folding metadata to fall back to the first visible descendant.
5. **Apply scroll** – Set the target container’s `scrollTop` on the next animation frame. A short-lived programmatic flag ensures the target listener ignores the resulting event.
6. **Optional smoothing** – If desired, the manager can blend the target scroll value to reduce jitter when the two views have drastically different heights.

## Collapse and Expand Handling

- **CodeView** already swaps collapsed children for a synthetic span that inherits the container’s chunk ID. The cache treats this span as the anchor when `isCollapsed` is `true`.
- **MarkdownView** hides the original elements and inserts a collapsed indicator before them. The manager prefers the indicator when measuring a collapsed chunk so that both panes align on the placeholder instead of the hidden content.
- When a collapsed container expands, both views restore their original elements and the folding event triggers cache rebuilding automatically.

## Edge Cases and Fallbacks

- **Inline mixing** – `getClientRects()` may return multiple rects for inline spans. The measurement logic unions them to ensure the chunk covers the full line.
- **Zero-height ranges** – Markers with zero height are clamped to at least one pixel to keep offsets increasing monotonically.
- **Hidden view modes** – When one pane is hidden (Code-only or Markdown-only mode), the manager pauses synchronization toward the hidden view and resumes once it becomes visible.
- **Viewport resizing** – Resizing triggers cache invalidation and synchronization from the most recent logical offset, keeping both panes aligned.
- **Missing chunk IDs** – If a chunk does not exist in a particular view, the manager walks through descendants via folding metadata to locate the next best anchor.

## Testing Strategy

The Vitest + JSDOM test suite exercises the manager by simulating scroll events, folding, and layout mutations. Tests stub `getBoundingClientRect()` so that deterministic measurements drive cache updates. Integration tests verify that the toolbar toggle switches synchronization on and off and that collapsing chunks in CodeView affects MarkdownView measurements correctly.
