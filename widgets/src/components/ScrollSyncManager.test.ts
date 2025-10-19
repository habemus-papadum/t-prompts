import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FoldingController } from '../folding/controller';
import { ScrollSyncManager } from './ScrollSyncManager';

declare global {
  var requestAnimationFrame: ((callback: FrameRequestCallback) => number) | undefined;
  var cancelAnimationFrame: ((handle: number) => void) | undefined;
}

describe('ScrollSyncManager', () => {
  let controller: FoldingController;
  let codeContainer: HTMLDivElement;
  let markdownContainer: HTMLDivElement;
  let rafId: number;
  let pendingFrames: Map<number, ReturnType<typeof setTimeout>>;
  const originalRAF = globalThis.requestAnimationFrame;
  const originalCancelRAF = globalThis.cancelAnimationFrame;

  beforeEach(() => {
    controller = new FoldingController(['chunk-1', 'chunk-2', 'chunk-3']);
    codeContainer = document.createElement('div');
    markdownContainer = document.createElement('div');
    rafId = 0;
    pendingFrames = new Map();

    document.body.appendChild(codeContainer);
    document.body.appendChild(markdownContainer);

    Object.defineProperty(codeContainer, 'getBoundingClientRect', {
      value: () => ({ top: 0, bottom: 300, left: 0, right: 100, width: 100, height: 300 }),
    });
    Object.defineProperty(markdownContainer, 'getBoundingClientRect', {
      value: () => ({ top: 0, bottom: 360, left: 0, right: 100, width: 100, height: 360 }),
    });
    Object.defineProperty(codeContainer, 'clientHeight', {
      value: 120,
      configurable: true,
    });
    Object.defineProperty(codeContainer, 'scrollHeight', {
      value: 320,
      configurable: true,
    });
    Object.defineProperty(markdownContainer, 'clientHeight', {
      value: 150,
      configurable: true,
    });
    Object.defineProperty(markdownContainer, 'scrollHeight', {
      value: 480,
      configurable: true,
    });

    let codeScrollTop = 0;
    Object.defineProperty(codeContainer, 'scrollTop', {
      get: () => codeScrollTop,
      set: (value: number) => {
        codeScrollTop = value;
      },
      configurable: true,
    });

    let markdownScrollTop = 0;
    Object.defineProperty(markdownContainer, 'scrollTop', {
      get: () => markdownScrollTop,
      set: (value: number) => {
        markdownScrollTop = value;
      },
      configurable: true,
    });

    globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      const id = ++rafId;
      const timeout = setTimeout(() => {
        pendingFrames.delete(id);
        callback(0);
      }, 0);
      pendingFrames.set(id, timeout);
      return id;
    };
    globalThis.cancelAnimationFrame = (handle: number): void => {
      const timeout = pendingFrames.get(handle);
      if (timeout !== undefined) {
        clearTimeout(timeout);
        pendingFrames.delete(handle);
      }
    };
  });

  function createAnchor(top: number, height: number): HTMLDivElement {
    const el = document.createElement('div');
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({
        top,
        bottom: top + height,
        left: 0,
        right: 100,
        width: 100,
        height,
      }),
    });
    Object.defineProperty(el, 'getClientRects', {
      value: (): DOMRectList =>
        ({ length: 0, item: () => null } as unknown as DOMRectList),
    });
    return el;
  }

  function createManager({
    codeAnchors,
    markdownAnchors,
  }: {
    codeAnchors: Record<string, HTMLElement>;
    markdownAnchors: Record<string, HTMLElement>;
  }): ScrollSyncManager {
    const manager = new ScrollSyncManager({
      foldingController: controller,
      code: {
        id: 'code',
        scrollContainer: codeContainer,
        getAnchors: (chunkId: string): HTMLElement[] => [codeAnchors[chunkId]].filter(Boolean),
      },
      markdown: {
        id: 'markdown',
        scrollContainer: markdownContainer,
        getAnchors: (chunkId: string): HTMLElement[] =>
          [markdownAnchors[chunkId]].filter(Boolean),
      },
    });

    manager.observe();
    return manager;
  }

  afterEach(() => {
    codeContainer.remove();
    markdownContainer.remove();
    pendingFrames.forEach((timeout) => clearTimeout(timeout));
    pendingFrames.clear();
    if (originalRAF) {
      globalThis.requestAnimationFrame = originalRAF;
    } else {
      delete globalThis.requestAnimationFrame;
    }
    if (originalCancelRAF) {
      globalThis.cancelAnimationFrame = originalCancelRAF;
    } else {
      delete globalThis.cancelAnimationFrame;
    }
  });

  async function flushFrames(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('mirrors scroll position between code and markdown views', async () => {
    const anchors = {
      code: {
        'chunk-1': createAnchor(0, 100),
        'chunk-2': createAnchor(100, 100),
        'chunk-3': createAnchor(200, 100),
      },
      markdown: {
        'chunk-1': createAnchor(0, 60),
        'chunk-2': createAnchor(60, 180),
        'chunk-3': createAnchor(240, 120),
      },
    };

    codeContainer.appendChild(anchors.code['chunk-1']);
    codeContainer.appendChild(anchors.code['chunk-2']);
    codeContainer.appendChild(anchors.code['chunk-3']);
    markdownContainer.appendChild(anchors.markdown['chunk-1']);
    markdownContainer.appendChild(anchors.markdown['chunk-2']);
    markdownContainer.appendChild(anchors.markdown['chunk-3']);

    const manager = createManager({ codeAnchors: anchors.code, markdownAnchors: anchors.markdown });

    const caches = manager as unknown as { caches: Record<string, { entries: unknown[] }> };
    expect(caches.caches.markdown.entries.length).toBe(3);

    const tapManager = manager as unknown as {
      applyScroll: (viewId: string, scrollTop: number) => void;
    };
    const applied: Array<{ viewId: string; scrollTop: number }> = [];
    const originalApplyScroll = tapManager.applyScroll.bind(manager);
    tapManager.applyScroll = (viewId: string, scrollTop: number): void => {
      applied.push({ viewId, scrollTop });
      originalApplyScroll(viewId, scrollTop);
    };

    codeContainer.scrollTop = 150;
    codeContainer.dispatchEvent(new Event('scroll'));

    await flushFrames();

    expect(applied).not.toEqual([]);

    expect(markdownContainer.scrollTop).toBeGreaterThan(140);
    expect(markdownContainer.scrollTop).toBeLessThan(170);

    manager.markDirty('layout');

    await flushFrames();

    // After a layout change, ensure scrollTop stays aligned
    expect(markdownContainer.scrollTop).toBeGreaterThan(140);
    expect(markdownContainer.scrollTop).toBeLessThan(170);

    manager.destroy();
  });

  it('stops syncing when disabled', async () => {
    const anchors = {
      code: {
        'chunk-1': createAnchor(0, 100),
        'chunk-2': createAnchor(100, 100),
        'chunk-3': createAnchor(200, 100),
      },
      markdown: {
        'chunk-1': createAnchor(0, 100),
        'chunk-2': createAnchor(100, 100),
        'chunk-3': createAnchor(200, 100),
      },
    };

    Object.values(anchors.code).forEach((el) => codeContainer.appendChild(el));
    Object.values(anchors.markdown).forEach((el) => markdownContainer.appendChild(el));

    const manager = createManager({ codeAnchors: anchors.code, markdownAnchors: anchors.markdown });

    manager.setEnabled(false);

    codeContainer.scrollTop = 150;
    codeContainer.dispatchEvent(new Event('scroll'));

    await flushFrames();

    expect(markdownContainer.scrollTop).toBe(0);

    manager.setEnabled(true);

    codeContainer.scrollTop = 200;
    codeContainer.dispatchEvent(new Event('scroll'));

    await flushFrames();

    expect(markdownContainer.scrollTop).toBeCloseTo(200, 5);

    manager.destroy();
  });
});
