import type { FoldingController } from '../folding/controller';
import type { FoldingClient, FoldingEvent, FoldingState } from '../folding/types';

type ViewId = 'code' | 'markdown';

interface ScrollSyncViewConfig {
  id: ViewId;
  scrollContainer: HTMLElement;
  getAnchors(chunkId: string): HTMLElement[];
}

interface ChunkLayoutEntry {
  chunkId: string;
  anchors: HTMLElement[];
  top: number;
  bottom: number;
  height: number;
  startOffset: number;
  isCollapsed: boolean;
}

interface ChunkLayoutCache {
  entries: ChunkLayoutEntry[];
  byId: Map<string, ChunkLayoutEntry>;
  totalHeight: number;
  timestamp: number;
}

const EMPTY_CACHE: ChunkLayoutCache = {
  entries: [],
  byId: new Map(),
  totalHeight: 0,
  timestamp: 0,
};

export interface ScrollSyncManagerOptions {
  foldingController: FoldingController;
  code: ScrollSyncViewConfig;
  markdown: ScrollSyncViewConfig;
}

interface LogicalAnchor {
  chunkId: string;
  progress: number;
}

function cloneCache(cache: ChunkLayoutCache): ChunkLayoutCache {
  return {
    entries: [...cache.entries],
    byId: new Map(cache.byId),
    totalHeight: cache.totalHeight,
    timestamp: cache.timestamp,
  };
}

export class ScrollSyncManager implements FoldingClient {
  private readonly foldingController: FoldingController;
  private readonly views: Record<ViewId, ScrollSyncViewConfig>;
  private caches: Record<ViewId, ChunkLayoutCache> = {
    code: cloneCache(EMPTY_CACHE),
    markdown: cloneCache(EMPTY_CACHE),
  };
  private enabled = true;
  private activeSource: ViewId | null = null;
  private readonly programmaticScroll = new Set<ViewId>();
  private pendingRecalcHandle: number | null = null;
  private lastAnchor: LogicalAnchor | null = null;
  private observing = false;
  private readonly viewVisibility: Record<ViewId, boolean> = { code: true, markdown: true };
  private readonly scrollHandlers: Record<ViewId, (event: Event) => void> = {
    code: () => {},
    markdown: () => {},
  };
  private readonly resizeObservers: Partial<Record<ViewId, ResizeObserver>> = {};
  private readonly mutationObservers: MutationObserver[] = [];
  private resetActiveSourceHandle: number | null = null;
  private readonly rafHandles = new Set<number>();
  private readonly timeoutHandles = new Set<number>();
  private readonly foldingClient: FoldingClient;
  private destroyed = false;
  private pendingReasons: Set<string> = new Set();

  constructor(options: ScrollSyncManagerOptions) {
    this.foldingController = options.foldingController;
    this.views = {
      code: options.code,
      markdown: options.markdown,
    };

    this.foldingClient = {
      onStateChanged: (event: FoldingEvent, _state: Readonly<FoldingState>) => {
        switch (event.type) {
          case 'chunks-collapsed':
          case 'chunk-expanded':
          case 'state-reset':
            this.markDirty(event.type);
            break;
          default:
            break;
        }
      },
    };
  }

  observe(): void {
    if (this.observing || this.destroyed) {
      return;
    }

    (['code', 'markdown'] as const).forEach((viewId) => {
      const handler = (_event: Event): void => {
        if (!this.enabled || this.destroyed) {
          return;
        }

        if (!this.viewVisibility[viewId]) {
          return;
        }

        if (this.programmaticScroll.has(viewId)) {
          this.programmaticScroll.delete(viewId);
          return;
        }

        if (this.activeSource && this.activeSource !== viewId) {
          return;
        }

        this.activeSource = viewId;
        if (this.resetActiveSourceHandle === null) {
          this.resetActiveSourceHandle = this.scheduleFrame(() => {
            this.activeSource = null;
            this.resetActiveSourceHandle = null;
          });
        }

        this.syncScroll(viewId);
      };

      this.scrollHandlers[viewId] = handler;
      this.views[viewId].scrollContainer.addEventListener('scroll', handler, { passive: true });

      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => this.markDirty('resize'));
        observer.observe(this.views[viewId].scrollContainer);
        this.resizeObservers[viewId] = observer;
      }

      if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(() => this.markDirty('mutation'));
        observer.observe(this.views[viewId].scrollContainer, {
          childList: true,
          subtree: true,
          attributes: true,
        });
        this.mutationObservers.push(observer);
      }
    });

    this.foldingController.addClient(this.foldingClient);
    this.observing = true;
    this.rebuildCaches('initial');
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    (['code', 'markdown'] as const).forEach((viewId) => {
      const handler = this.scrollHandlers[viewId];
      this.views[viewId].scrollContainer.removeEventListener('scroll', handler);
      const resizeObserver = this.resizeObservers[viewId];
      resizeObserver?.disconnect();
    });

    for (const observer of this.mutationObservers) {
      observer.disconnect();
    }

    if (this.pendingRecalcHandle !== null) {
      this.cancelFrame(this.pendingRecalcHandle);
      this.pendingRecalcHandle = null;
    }

    if (this.resetActiveSourceHandle !== null) {
      this.cancelFrame(this.resetActiveSourceHandle);
      this.resetActiveSourceHandle = null;
    }

    for (const handle of Array.from(this.rafHandles)) {
      this.cancelFrame(handle);
    }
    for (const handle of Array.from(this.timeoutHandles)) {
      this.cancelFrame(handle);
    }

    this.foldingController.removeClient(this.foldingClient);
    this.destroyed = true;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }
    this.enabled = enabled;
    if (enabled) {
      this.markDirty('enabled');
    }
  }

  setViewVisibility(viewId: ViewId, visible: boolean): void {
    if (this.viewVisibility[viewId] === visible) {
      return;
    }
    this.viewVisibility[viewId] = visible;
    this.markDirty(`visibility:${viewId}`);
  }

  markDirty(reason: string): void {
    if (this.destroyed) {
      return;
    }

    this.pendingReasons.add(reason);

    if (this.pendingRecalcHandle !== null) {
      return;
    }

    this.pendingRecalcHandle = this.scheduleFrame(() => {
      this.pendingRecalcHandle = null;
      this.rebuildCaches([...this.pendingReasons].join(','));
      this.pendingReasons.clear();
    });
  }

  onStateChanged(event: FoldingEvent, state: Readonly<FoldingState>): void {
    this.foldingClient.onStateChanged(event, state);
  }

  private rebuildCaches(_trigger: string): void {
    if (this.destroyed) {
      return;
    }

    const nextCaches: Record<ViewId, ChunkLayoutCache> = {
      code: this.viewVisibility.code ? this.measureView('code') : cloneCache(EMPTY_CACHE),
      markdown: this.viewVisibility.markdown ? this.measureView('markdown') : cloneCache(EMPTY_CACHE),
    };

    this.caches = nextCaches;
    this.applyAnchorToViews();
  }

  private syncScroll(source: ViewId): void {
    const cache = this.caches[source];
    if (!cache.entries.length) {
      this.rebuildCaches('lazy');
    }

    const updatedCache = this.caches[source];
    if (!updatedCache.entries.length) {
      return;
    }

    const container = this.views[source].scrollContainer;
    const scrollTop = container.scrollTop;
    const entry = this.findEntryForScroll(updatedCache.entries, scrollTop);
    if (!entry) {
      return;
    }

    const offsetWithinChunk = scrollTop - entry.top;
    const progress = entry.height > 0 ? this.clamp(offsetWithinChunk / entry.height, 0, 1) : 0;
    this.lastAnchor = { chunkId: entry.chunkId, progress };

    const target: ViewId = source === 'code' ? 'markdown' : 'code';
    if (!this.enabled || !this.viewVisibility[target]) {
      return;
    }

    const targetEntry = this.resolveEntry(target, entry.chunkId);
    if (!targetEntry) {
      return;
    }

    const targetScrollTop = targetEntry.top + targetEntry.height * progress;
    this.applyScroll(target, targetScrollTop);
  }

  private applyAnchorToViews(): void {
    if (!this.lastAnchor) {
      return;
    }

    (['code', 'markdown'] as const).forEach((viewId) => {
      if (!this.viewVisibility[viewId]) {
        return;
      }
      const entry = this.resolveEntry(viewId, this.lastAnchor!.chunkId);
      if (!entry) {
        return;
      }
      const scrollTop = entry.top + entry.height * this.lastAnchor!.progress;
      this.applyScroll(viewId, scrollTop);
    });
  }

  private applyScroll(viewId: ViewId, scrollTop: number): void {
    const container = this.views[viewId].scrollContainer;
    this.programmaticScroll.add(viewId);
    this.scheduleFrame(() => {
      container.scrollTop = scrollTop;
      this.programmaticScroll.delete(viewId);
    });
  }

  private measureView(viewId: ViewId): ChunkLayoutCache {
    const view = this.views[viewId];
    if (!this.isMeasureable(view.scrollContainer)) {
      return cloneCache(EMPTY_CACHE);
    }

    const visibleSequence = this.foldingController.getVisibleSequence();
    const entries: ChunkLayoutEntry[] = [];
    const byId = new Map<string, ChunkLayoutEntry>();
    const containerRect = view.scrollContainer.getBoundingClientRect();
    const containerScrollTop = view.scrollContainer.scrollTop;
    let runningOffset = 0;

    for (const chunkId of visibleSequence) {
      const anchors = this.collectAnchors(viewId, chunkId);
      if (!anchors.length) {
        continue;
      }

      const measurement = this.measureAnchors(anchors, containerRect, containerScrollTop);
      if (!measurement) {
        continue;
      }

      const { top, bottom } = measurement;
      const height = Math.max(1, bottom - top);
      const entry: ChunkLayoutEntry = {
        chunkId,
        anchors,
        top,
        bottom,
        height,
        startOffset: runningOffset,
        isCollapsed: this.foldingController.isCollapsed(chunkId),
      };

      entries.push(entry);
      byId.set(chunkId, entry);
      runningOffset += height;
    }

    return {
      entries,
      byId,
      totalHeight: runningOffset,
      timestamp: Date.now(),
    };
  }

  private collectAnchors(viewId: ViewId, chunkId: string, depth = 0): HTMLElement[] {
    if (depth > 32) {
      return [];
    }
    const view = this.views[viewId];
    const anchors = view
      .getAnchors(chunkId)
      .filter((el) =>
        typeof el.isConnected === 'boolean' ? el.isConnected : document.contains(el)
      );
    if (anchors.length) {
      return anchors;
    }

    const collapsed = this.foldingController.getCollapsedChunk(chunkId);
    if (!collapsed) {
      return [];
    }

    for (const childId of collapsed.children) {
      const childAnchors = this.collectAnchors(viewId, childId, depth + 1);
      if (childAnchors.length) {
        return childAnchors;
      }
    }

    return [];
  }

  private resolveEntry(viewId: ViewId, chunkId: string, depth = 0): ChunkLayoutEntry | null {
    if (depth > 32) {
      return null;
    }

    const cache = this.caches[viewId];
    const direct = cache.byId.get(chunkId);
    if (direct) {
      return direct;
    }

    const collapsed = this.foldingController.getCollapsedChunk(chunkId);
    if (!collapsed) {
      return null;
    }

    for (const childId of collapsed.children) {
      const entry = this.resolveEntry(viewId, childId, depth + 1);
      if (entry) {
        return entry;
      }
    }

    return null;
  }

  private measureAnchors(
    anchors: HTMLElement[],
    containerRect: DOMRect,
    containerScrollTop: number
  ): { top: number; bottom: number } | null {
    let minTop = Number.POSITIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;
    let found = false;

    for (const anchor of anchors) {
      const rectList = anchor.getClientRects();
      if (rectList.length > 0) {
        for (let i = 0; i < rectList.length; i++) {
          const rect = rectList.item(i);
          if (!rect) continue;
          const top = rect.top - containerRect.top + containerScrollTop;
          const bottom = rect.bottom - containerRect.top + containerScrollTop;
          if (!Number.isFinite(top) || !Number.isFinite(bottom)) {
            continue;
          }
          minTop = Math.min(minTop, top);
          maxBottom = Math.max(maxBottom, bottom);
          found = true;
        }
        continue;
      }

      const rect = anchor.getBoundingClientRect();
      const top = rect.top - containerRect.top + containerScrollTop;
      const bottom = rect.bottom - containerRect.top + containerScrollTop;
      if (!Number.isFinite(top) || !Number.isFinite(bottom)) {
        continue;
      }
      minTop = Math.min(minTop, top);
      maxBottom = Math.max(maxBottom, bottom);
      found = true;
    }

    if (!found) {
      return null;
    }

    return { top: minTop, bottom: maxBottom };
  }

  private findEntryForScroll(entries: ChunkLayoutEntry[], scrollTop: number): ChunkLayoutEntry | null {
    if (!entries.length) {
      return null;
    }

    let low = 0;
    let high = entries.length - 1;
    let candidate = entries[0];

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const entry = entries[mid];

      if (scrollTop < entry.top) {
        candidate = entry;
        high = mid - 1;
      } else if (scrollTop > entry.bottom) {
        low = mid + 1;
        candidate = entry;
      } else {
        return entry;
      }
    }

    if (scrollTop >= entries[entries.length - 1].bottom) {
      return entries[entries.length - 1];
    }

    if (scrollTop <= entries[0].top) {
      return entries[0];
    }

    return candidate;
  }

  private scheduleFrame(callback: () => void): number {
    if (typeof requestAnimationFrame === 'function') {
      const id = requestAnimationFrame(() => {
        this.rafHandles.delete(id);
        callback();
      });
      this.rafHandles.add(id);
      return id;
    }

    const timeout = window.setTimeout(() => {
      this.timeoutHandles.delete(timeout);
      callback();
    }, 16);
    this.timeoutHandles.add(timeout);
    return timeout;
  }

  private cancelFrame(handle: number): void {
    if (this.rafHandles.delete(handle)) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(handle);
      }
      return;
    }

    if (this.timeoutHandles.delete(handle)) {
      clearTimeout(handle);
    }
  }

  private isMeasureable(container: HTMLElement): boolean {
    const rect = container.getBoundingClientRect();
    return rect.width !== 0 || rect.height !== 0;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
