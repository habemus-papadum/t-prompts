import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScrollSyncManager } from './ScrollSyncManager';
import { FoldingController } from '../folding/controller';
import type { CodeView } from './CodeView';
import type { MarkdownView } from './MarkdownView';

const rafOriginal = globalThis.requestAnimationFrame;
const cafOriginal = globalThis.cancelAnimationFrame;

function createRect(top: number, height: number): DOMRect {
  return new window.DOMRect(0, top, 100, height);
}

function stubRects(element: HTMLElement, top: number, height: number): void {
  const rect = createRect(top, height);
  element.getBoundingClientRect = () => rect;
  element.getClientRects = () => {
    const list: DOMRectList & { [index: number]: DOMRectReadOnly } = {
      length: 1,
      item: (index: number) => (index === 0 ? rect : null),
      [0]: rect,
    } as DOMRectList & { [index: number]: DOMRectReadOnly };
    return list;
  };
}

async function flushFrames(times = 2): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('ScrollSyncManager', () => {
  beforeEach(() => {
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      return window.setTimeout(() => callback(Date.now()), 0);
    };
    globalThis.cancelAnimationFrame = (handle: number): void => {
      window.clearTimeout(handle);
    };
  });

  afterEach(() => {
    if (rafOriginal) {
      globalThis.requestAnimationFrame = rafOriginal;
    }
    if (cafOriginal) {
      globalThis.cancelAnimationFrame = cafOriginal;
    }
    document.body.innerHTML = '';
  });

  it('syncs markdown scroll position to code view scrolls', async () => {
    const controller = new FoldingController(['chunk1', 'chunk2']);

    const codePanel = document.createElement('div');
    codePanel.className = 'tp-panel tp-code-panel';
    codePanel.style.height = '400px';
    codePanel.style.overflow = 'auto';
    codePanel.getBoundingClientRect = () => createRect(0, 400);

    const markdownPanel = document.createElement('div');
    markdownPanel.className = 'tp-panel tp-markdown-panel';
    markdownPanel.style.height = '400px';
    markdownPanel.style.overflow = 'auto';
    markdownPanel.getBoundingClientRect = () => createRect(0, 400);

    const wrapper = document.createElement('div');
    wrapper.appendChild(codePanel);
    wrapper.appendChild(markdownPanel);
    document.body.appendChild(wrapper);

    const codeElement = document.createElement('div');
    codePanel.appendChild(codeElement);

    const codeChunk1 = document.createElement('span');
    stubRects(codeChunk1, 0, 100);
    const codeChunk2 = document.createElement('span');
    stubRects(codeChunk2, 100, 100);

    codeElement.appendChild(codeChunk1);
    codeElement.appendChild(codeChunk2);

    const codeView: CodeView = {
      element: codeElement,
      chunkIdToTopElements: new Map([
        ['chunk1', [codeChunk1]],
        ['chunk2', [codeChunk2]],
      ]),
      destroy() {
        /* noop */
      },
    };

    const markdownElement = document.createElement('div');
    markdownPanel.appendChild(markdownElement);

    const markdownChunk1 = document.createElement('div');
    stubRects(markdownChunk1, 0, 200);
    const markdownChunk2 = document.createElement('div');
    stubRects(markdownChunk2, 200, 100);

    markdownElement.appendChild(markdownChunk1);
    markdownElement.appendChild(markdownChunk2);

    const markdownView: MarkdownView = {
      element: markdownElement,
      chunkIdToElements: new Map([
        ['chunk1', [markdownChunk1]],
        ['chunk2', [markdownChunk2]],
      ]),
      getLayoutElements(chunkId: string) {
        return this.chunkIdToElements.get(chunkId);
      },
      destroy() {
        /* noop */
      },
    };

    const manager = new ScrollSyncManager({
      controller,
      codeView,
      markdownView,
      codePanel,
      markdownPanel,
    });

    await flushFrames();

    codePanel.scrollTop = 150;
    codePanel.dispatchEvent(new Event('scroll'));

    await flushFrames(3);

    expect(markdownPanel.scrollTop).toBeCloseTo(250, 2);

    manager.destroy();
  });

  it('stops syncing when disabled and resumes when re-enabled', async () => {
    const controller = new FoldingController(['chunk1', 'chunk2']);

    const codePanel = document.createElement('div');
    codePanel.className = 'tp-panel tp-code-panel';
    codePanel.style.height = '400px';
    codePanel.style.overflow = 'auto';
    codePanel.getBoundingClientRect = () => createRect(0, 400);

    const markdownPanel = document.createElement('div');
    markdownPanel.className = 'tp-panel tp-markdown-panel';
    markdownPanel.style.height = '400px';
    markdownPanel.style.overflow = 'auto';
    markdownPanel.getBoundingClientRect = () => createRect(0, 400);

    document.body.appendChild(codePanel);
    document.body.appendChild(markdownPanel);

    const codeElement = document.createElement('div');
    codePanel.appendChild(codeElement);
    const codeChunk = document.createElement('span');
    stubRects(codeChunk, 0, 200);
    codeElement.appendChild(codeChunk);

    const markdownElement = document.createElement('div');
    markdownPanel.appendChild(markdownElement);
    const markdownChunk = document.createElement('div');
    stubRects(markdownChunk, 0, 200);
    markdownElement.appendChild(markdownChunk);

    const codeView: CodeView = {
      element: codeElement,
      chunkIdToTopElements: new Map([['chunk1', [codeChunk]]]),
      destroy() {
        /* noop */
      },
    };

    const markdownView: MarkdownView = {
      element: markdownElement,
      chunkIdToElements: new Map([['chunk1', [markdownChunk]]]),
      getLayoutElements(chunkId: string) {
        return this.chunkIdToElements.get(chunkId);
      },
      destroy() {
        /* noop */
      },
    };

    const manager = new ScrollSyncManager({
      controller,
      codeView,
      markdownView,
      codePanel,
      markdownPanel,
    });

    await flushFrames();

    manager.setEnabled(false);

    markdownPanel.scrollTop = 0;
    codePanel.scrollTop = 100;
    codePanel.dispatchEvent(new Event('scroll'));

    await flushFrames(2);
    expect(markdownPanel.scrollTop).toBe(0);

    manager.setEnabled(true);
    await flushFrames();

    codePanel.scrollTop = 150;
    codePanel.dispatchEvent(new Event('scroll'));
    await flushFrames(3);

    expect(markdownPanel.scrollTop).toBeGreaterThan(0);

    manager.destroy();
  });

  it('falls back to child chunk measurements when collapsed container lacks anchors', async () => {
    const controller = new FoldingController(['chunk1', 'chunk2', 'chunk3']);
    controller.addSelection(1, 1);
    const [collapsedId] = controller.commitSelections();

    const codePanel = document.createElement('div');
    codePanel.className = 'tp-panel tp-code-panel';
    codePanel.style.height = '400px';
    codePanel.style.overflow = 'auto';
    codePanel.getBoundingClientRect = () => createRect(0, 400);

    const markdownPanel = document.createElement('div');
    markdownPanel.className = 'tp-panel tp-markdown-panel';
    markdownPanel.style.height = '400px';
    markdownPanel.style.overflow = 'auto';
    markdownPanel.getBoundingClientRect = () => createRect(0, 400);

    document.body.appendChild(codePanel);
    document.body.appendChild(markdownPanel);

    const codeElement = document.createElement('div');
    codePanel.appendChild(codeElement);

    const codeChunk1 = document.createElement('span');
    stubRects(codeChunk1, 0, 100);
    const codeCollapsed = document.createElement('span');
    stubRects(codeCollapsed, 100, 40);

    codeElement.appendChild(codeChunk1);
    codeElement.appendChild(codeCollapsed);

    const codeView: CodeView = {
      element: codeElement,
      chunkIdToTopElements: new Map([
        ['chunk1', [codeChunk1]],
        [collapsedId, [codeCollapsed]],
        ['chunk2', [codeCollapsed]],
      ]),
      destroy() {
        /* noop */
      },
    };

    const markdownElement = document.createElement('div');
    markdownPanel.appendChild(markdownElement);

    const markdownChunk1 = document.createElement('div');
    stubRects(markdownChunk1, 0, 150);
    const markdownChunk2 = document.createElement('div');
    stubRects(markdownChunk2, 150, 50);

    markdownElement.appendChild(markdownChunk1);
    markdownElement.appendChild(markdownChunk2);

    const markdownView: MarkdownView = {
      element: markdownElement,
      chunkIdToElements: new Map([
        ['chunk1', [markdownChunk1]],
        ['chunk2', [markdownChunk2]],
        ['chunk3', []],
      ]),
      getLayoutElements(chunkId: string) {
        if (chunkId === collapsedId) {
          return undefined;
        }
        return this.chunkIdToElements.get(chunkId);
      },
      destroy() {
        /* noop */
      },
    };

    const manager = new ScrollSyncManager({
      controller,
      codeView,
      markdownView,
      codePanel,
      markdownPanel,
    });

    await flushFrames();

    codePanel.scrollTop = 110;
    codePanel.dispatchEvent(new Event('scroll'));
    await flushFrames(3);

    expect(markdownPanel.scrollTop).toBeGreaterThan(150);
    expect(markdownPanel.scrollTop).toBeLessThan(200);

    manager.destroy();
  });
});
