import type { FoldingClient, FoldingEvent } from '../folding/types';
import type { FoldingController } from '../folding/controller';
import type { CodeView } from './CodeView';
import type { MarkdownView } from './MarkdownView';

type ViewKind = 'code' | 'markdown';

type DirtyReason = 'init' | 'folding' | 'mutation' | 'resize' | 'asset-load' | 'view-mode';

interface ScrollSyncOptions {
  controller: FoldingController;
  codeView: CodeView;
  markdownView: MarkdownView;
  codePanel: HTMLElement;
  markdownPanel: HTMLElement;
  debug?: boolean;
}

interface ChunkLayoutEntry {
  chunkId: string;
  anchors: HTMLElement[];
  rects: DOMRectReadOnly[];
  top: number;
  bottom: number;
  height: number;
  isCollapsed: boolean;
  sequenceIndex: number;
}

interface ChunkLayoutCache {
  entries: ChunkLayoutEntry[];
  byId: Map<string, ChunkLayoutEntry>;
  totalHeight: number;
  timestamp: number;
}

interface LogicalPosition {
  chunkId: string;
  progress: number;
  sequenceIndex: number;
}

const MIN_ENTRY_HEIGHT = 1;

function createEmptyCache(): ChunkLayoutCache {
  return {
    entries: [],
    byId: new Map(),
    totalHeight: 0,
    timestamp: Date.now(),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function requestFrame(callback: FrameRequestCallback): number {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback);
  }

  return globalThis.setTimeout(() => {
    const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
    callback(now);
  }, 16) as unknown as number;
}

function cancelFrame(handle: number): void {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle);
    return;
  }

  globalThis.clearTimeout(handle);
}

export class ScrollSyncManager implements FoldingClient {
  private readonly controller: FoldingController;
  private readonly codeView: CodeView;
  private readonly markdownView: MarkdownView;
  private readonly codePanel: HTMLElement;
  private readonly markdownPanel: HTMLElement;

  private readonly scrollHandlers: Map<ViewKind, () => void> = new Map();
  private readonly programmaticScroll: Map<ViewKind, boolean> = new Map();

  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;

  private enabled = true;
  private activeSource: ViewKind | null = null;
  private releaseHandle: number | null = null;
  private pendingRecalc: number | null = null;
  private syncPending = false;
  private dirtyReasons = new Set<DirtyReason>();
  private lastLogicalPosition: LogicalPosition | null = null;
  private debug = false;

  private caches: { code: ChunkLayoutCache; markdown: ChunkLayoutCache } = {
    code: createEmptyCache(),
    markdown: createEmptyCache(),
  };

  constructor(options: ScrollSyncOptions) {
    this.controller = options.controller;
    this.codeView = options.codeView;
    this.markdownView = options.markdownView;
    this.codePanel = options.codePanel;
    this.markdownPanel = options.markdownPanel;
    this.debug = options.debug ?? false;

    this.observe();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  setDebug(enabled: boolean): void {
    this.debug = enabled;
    if (enabled) {
      console.log('[ScrollSyncManager] Debug mode enabled');
    }
  }

  markDirty(reason: DirtyReason): void {
    this.dirtyReasons.add(reason);

    if (this.pendingRecalc !== null) {
      return;
    }

    this.pendingRecalc = requestFrame(() => {
      this.pendingRecalc = null;
      this.rebuildCaches();
      this.dirtyReasons.clear();
    });
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }

    this.enabled = enabled;

    if (enabled) {
      this.markDirty('view-mode');
    }
  }

  observe(): void {
    this.attachScrollHandlers();
    this.observeLayout();
    this.controller.addClient(this);
    this.markDirty('init');
  }

  destroy(): void {
    this.controller.removeClient(this);

    this.detachScrollHandlers();
    this.disconnectObservers();

    if (this.pendingRecalc !== null) {
      cancelFrame(this.pendingRecalc);
      this.pendingRecalc = null;
    }

    if (this.releaseHandle !== null) {
      cancelFrame(this.releaseHandle);
      this.releaseHandle = null;
    }

    this.dirtyReasons.clear();
    this.lastLogicalPosition = null;
  }

  onStateChanged(event: FoldingEvent): void {
    switch (event.type) {
      case 'chunks-collapsed':
      case 'chunk-expanded':
      case 'state-reset':
        this.markDirty('folding');
        break;
      default:
        break;
    }
  }

  handleViewVisibilityChange(): void {
    this.markDirty('view-mode');
  }

  private attachScrollHandlers(): void {
    const codeHandler = (): void => this.handleScroll('code');
    const markdownHandler = (): void => this.handleScroll('markdown');

    this.scrollHandlers.set('code', codeHandler);
    this.scrollHandlers.set('markdown', markdownHandler);

    this.codePanel.addEventListener('scroll', codeHandler, { passive: true });
    this.markdownPanel.addEventListener('scroll', markdownHandler, { passive: true });
  }

  private detachScrollHandlers(): void {
    const codeHandler = this.scrollHandlers.get('code');
    if (codeHandler) {
      this.codePanel.removeEventListener('scroll', codeHandler);
    }

    const markdownHandler = this.scrollHandlers.get('markdown');
    if (markdownHandler) {
      this.markdownPanel.removeEventListener('scroll', markdownHandler);
    }

    this.scrollHandlers.clear();
  }

  private observeLayout(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.markDirty('resize');
      });

      this.resizeObserver.observe(this.codePanel);
      this.resizeObserver.observe(this.markdownPanel);
    }

    if (typeof MutationObserver !== 'undefined') {
      this.mutationObserver = new MutationObserver((mutations) => {
        // Ignore mutations during active scrolling to prevent layout thrashing
        if (this.activeSource !== null) {
          return;
        }

        // Only care about structural changes (childList), not attribute changes
        // This prevents excessive cache rebuilds from minor DOM updates
        const hasStructuralChange = mutations.some((m) => m.type === 'childList');
        if (hasStructuralChange) {
          this.markDirty('mutation');
        }
      });

      // Only watch for structural changes (childList), not attributes
      // attributes: true was causing excessive cache rebuilds during scroll
      const options: MutationObserverInit = { childList: true, subtree: true };
      this.mutationObserver.observe(this.codePanel, options);
      this.mutationObserver.observe(this.markdownPanel, options);
    }
  }

  private disconnectObservers(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = undefined;
    }
  }

  private rebuildCaches(): void {
    this.caches = {
      code: this.buildCache('code'),
      markdown: this.buildCache('markdown'),
    };

    if (this.lastLogicalPosition) {
      this.applyLogicalPosition(this.lastLogicalPosition);
    }
  }

  private buildCache(kind: ViewKind): ChunkLayoutCache {
    const cache = createEmptyCache();
    const visibleSequence = this.controller.getVisibleSequence();
    const container = kind === 'code' ? this.codePanel : this.markdownPanel;
    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;

    visibleSequence.forEach((chunkId, sequenceIndex) => {
      const anchors = this.resolveAnchors(kind, chunkId);
      if (!anchors || anchors.length === 0) {
        return;
      }

      const { rects, top, bottom } = this.measureAnchors(containerRect, scrollTop, anchors);

      if (rects.length === 0) {
        return;
      }

      const entry: ChunkLayoutEntry = {
        chunkId,
        anchors,
        rects,
        top,
        bottom,
        height: Math.max(MIN_ENTRY_HEIGHT, bottom - top),
        isCollapsed: this.controller.isCollapsed(chunkId),
        sequenceIndex,
      };

      cache.entries.push(entry);
      cache.byId.set(chunkId, entry);
      cache.totalHeight += entry.height;
    });

    cache.timestamp = Date.now();
    return cache;
  }

  private resolveAnchors(kind: ViewKind, chunkId: string, visited: Set<string> = new Set()): HTMLElement[] | undefined {
    if (visited.has(chunkId)) {
      return undefined;
    }

    visited.add(chunkId);

    const anchors = kind === 'code'
      ? this.codeView.chunkIdToTopElements.get(chunkId)
      : this.markdownView.getLayoutElements(chunkId);

    const filtered = anchors?.filter((node) => node && node.isConnected) ?? [];
    if (filtered.length > 0) {
      return filtered;
    }

    const collapsed = this.controller.getCollapsedChunk(chunkId);
    if (!collapsed) {
      return undefined;
    }

    for (const childId of collapsed.children) {
      const childAnchors = this.resolveAnchors(kind, childId, visited);
      if (childAnchors && childAnchors.length > 0) {
        return childAnchors;
      }
    }

    return undefined;
  }

  private measureAnchors(
    containerRect: DOMRectReadOnly,
    scrollTop: number,
    anchors: HTMLElement[],
  ): { rects: DOMRectReadOnly[]; top: number; bottom: number } {
    const rects: DOMRectReadOnly[] = [];

    for (const anchor of anchors) {
      const anchorRects = Array.from(anchor.getClientRects());
      if (anchorRects.length === 0) {
        const rect = anchor.getBoundingClientRect();
        if (rect) {
          rects.push(rect);
        }
        continue;
      }

      rects.push(...anchorRects);
    }

    if (rects.length === 0) {
      return { rects: [], top: 0, bottom: 0 };
    }

    let minTop = Number.POSITIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;

    rects.forEach((rect) => {
      const adjustedTop = rect.top - containerRect.top + scrollTop;
      const adjustedBottom = rect.bottom - containerRect.top + scrollTop;
      if (adjustedTop < minTop) {
        minTop = adjustedTop;
      }
      if (adjustedBottom > maxBottom) {
        maxBottom = adjustedBottom;
      }
    });

    return {
      rects,
      top: minTop,
      bottom: maxBottom,
    };
  }

  private handleScroll(source: ViewKind): void {
    if (!this.enabled) {
      return;
    }

    if (this.programmaticScroll.get(source)) {
      if (this.debug) {
        const panel = source === 'code' ? this.codePanel : this.markdownPanel;
        console.log(`[handleScroll] ${source} @ ${panel.scrollTop.toFixed(1)} - IGNORED (programmatic)`);
      }
      return;
    }

    const target: ViewKind = source === 'code' ? 'markdown' : 'code';

    if (this.activeSource && this.activeSource !== source) {
      if (this.debug) {
        console.log(`[handleScroll] ${source} - IGNORED (activeSource=${this.activeSource})`);
      }
      return;
    }

    if (this.debug) {
      const panel = source === 'code' ? this.codePanel : this.markdownPanel;
      console.log(`[handleScroll] ${source} @ ${panel.scrollTop.toFixed(1)}, syncPending=${this.syncPending}`);
    }

    this.activeSource = source;

    // Throttle: only sync once per frame to prevent excessive operations
    // during rapid scroll events (especially from mouse wheel)
    if (!this.syncPending) {
      this.syncPending = true;
      requestFrame(() => {
        this.syncPending = false;
        this.syncFrom(source, target);
      });
    }

    if (this.releaseHandle !== null) {
      cancelFrame(this.releaseHandle);
    }

    this.releaseHandle = requestFrame(() => {
      this.activeSource = null;
      this.releaseHandle = null;
    });
  }

  private syncFrom(source: ViewKind, target: ViewKind): void {
    const sourcePanel = source === 'code' ? this.codePanel : this.markdownPanel;
    const targetPanel = target === 'code' ? this.codePanel : this.markdownPanel;

    if (!this.isPanelVisible(targetPanel)) {
      return;
    }

    const sourceCache = this.caches[source];
    const targetCache = this.caches[target];

    if (sourceCache.entries.length === 0 || targetCache.entries.length === 0) {
      return;
    }

    const offset = sourcePanel.scrollTop;
    const located = this.findEntryForOffset(sourceCache, offset);
    if (!located) {
      return;
    }

    const { entry, index } = located;

    const progress = entry.height <= MIN_ENTRY_HEIGHT
      ? 0
      : clamp((offset - entry.top) / entry.height, 0, 1);

    const targetEntry = this.resolveTargetEntry(targetCache, entry.chunkId, index);
    if (!targetEntry) {
      return;
    }

    const targetScrollTop = targetEntry.top + progress * targetEntry.height;

    this.lastLogicalPosition = {
      chunkId: entry.chunkId,
      progress,
      sequenceIndex: entry.sequenceIndex,
    };

    this.setPanelScrollTop(target, targetScrollTop);
  }

  private isPanelVisible(panel: HTMLElement): boolean {
    if (panel.classList.contains('hidden')) {
      return false;
    }

    const style = window.getComputedStyle(panel);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  private findEntryForOffset(cache: ChunkLayoutCache, offset: number): { entry: ChunkLayoutEntry; index: number } | undefined {
    if (cache.entries.length === 0) {
      return undefined;
    }

    let low = 0;
    let high = cache.entries.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = cache.entries[mid];

      if (offset < candidate.top) {
        high = mid - 1;
      } else if (offset >= candidate.bottom) {
        low = mid + 1;
      } else {
        return { entry: candidate, index: mid };
      }
    }

    const clampedIndex = clamp(low, 0, cache.entries.length - 1);
    return { entry: cache.entries[clampedIndex], index: clampedIndex };
  }

  private resolveTargetEntry(
    cache: ChunkLayoutCache,
    chunkId: string,
    sourceIndex: number,
  ): ChunkLayoutEntry | undefined {
    const entry = cache.byId.get(chunkId);
    if (entry) {
      return entry;
    }

    const collapsed = this.controller.getCollapsedChunk(chunkId);
    if (collapsed) {
      for (const childId of collapsed.children) {
        const childEntry = cache.byId.get(childId);
        if (childEntry) {
          return childEntry;
        }
      }
    }

    if (cache.entries.length === 0) {
      return undefined;
    }

    const fallbackIndex = clamp(sourceIndex, 0, cache.entries.length - 1);
    return cache.entries[fallbackIndex];
  }

  private setPanelScrollTop(kind: ViewKind, value: number): void {
    const panel = kind === 'code' ? this.codePanel : this.markdownPanel;

    if (this.debug) {
      console.log(`[setPanelScrollTop] ${kind} → ${value.toFixed(1)}`);
    }

    this.programmaticScroll.set(kind, true);

    requestFrame(() => {
      panel.scrollTop = value;

      // Wait TWO frames before clearing the flag to ensure the scroll event
      // has fired and been processed. This prevents a race condition where
      // the flag is cleared before the scroll event fires, which would cause
      // the sync manager to think the programmatic scroll is a user scroll,
      // creating a feedback loop.
      requestFrame(() => {
        requestFrame(() => {
          this.programmaticScroll.set(kind, false);
          if (this.debug) {
            console.log(`[setPanelScrollTop] ${kind} flag cleared after ${value.toFixed(1)}`);
          }
        });
      });
    });
  }

  private applyLogicalPosition(position: LogicalPosition): void {
    const sourceEntry = this.resolveTargetEntry(this.caches.code, position.chunkId, position.sequenceIndex);
    const markdownEntry = this.resolveTargetEntry(this.caches.markdown, position.chunkId, position.sequenceIndex);

    if (sourceEntry) {
      const codeScroll = sourceEntry.top + position.progress * sourceEntry.height;
      this.setPanelScrollTop('code', codeScroll);
    }

    if (markdownEntry) {
      const markdownScroll = markdownEntry.top + position.progress * markdownEntry.height;
      this.setPanelScrollTop('markdown', markdownScroll);
    }
  }
}

export type { ChunkLayoutCache, ChunkLayoutEntry };
