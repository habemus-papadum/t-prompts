import type { Component } from './base';
import type { ViewMode } from '../types';
import type { ToolbarComponent } from './Toolbar';
import { updateToolbarMode } from './Toolbar';

const TREE_DEFAULT_WIDTH = 280;
const TREE_MIN_WIDTH = 200;
const TREE_MAX_WIDTH = 480;
const SPLIT_DEFAULT_RATIO = 0.5;
const SPLIT_MIN_RATIO = 0.25;
const SPLIT_MAX_RATIO = 0.75;

export interface StructuredPromptShellOptions {
  renderTree: () => Component;
  renderAfter: () => Component;
  renderMarkdown: () => Component;
  renderBefore?: () => Component | null;
  toolbar: ToolbarComponent;
  defaultViewMode: ViewMode;
  storageKeys: {
    treeWidth: string;
    splitRatio: string;
    treeCollapsed: string;
  };
  onTreeCollapse?: () => void;
  onTreeExpand?: () => void;
}

export interface StructuredPromptShell extends Component {
  toolbar: HTMLElement;
  contentArea: HTMLElement;
  treePanel: HTMLElement;
  beforePanel: HTMLElement | null;
  codePanel: HTMLElement;
  markdownPanel: HTMLElement;
  treeContainer: HTMLElement;
  mainSplit: HTMLElement;
  treeResizer: HTMLElement;
  splitResizer: HTMLElement;
  viewMode: ViewMode;
  setViewMode(mode: ViewMode): void;
  setBeforeVisible(visible: boolean): void;
  collapseTree(): void;
  expandTree(): void;
}

export function buildStructuredPromptShell(options: StructuredPromptShellOptions): StructuredPromptShell {
  const {
    renderTree,
    renderAfter,
    renderMarkdown,
    renderBefore,
    toolbar,
    defaultViewMode,
    storageKeys,
    onTreeCollapse,
    onTreeExpand,
  } = options;

  const element = document.createElement('div');
  element.className = 'tp-widget-output';

  const treeContainer = document.createElement('div');
  treeContainer.className = 'tp-tree-container';

  const treePanel = document.createElement('div');
  treePanel.className = 'tp-panel tp-tree-panel';

  const treeView = renderTree();
  treePanel.appendChild(treeView.element);

  const expandStrip = document.createElement('button');
  expandStrip.type = 'button';
  expandStrip.className = 'tp-tree-expand-strip';
  expandStrip.textContent = '▸';
  expandStrip.setAttribute('aria-label', 'Show tree view');

  treeContainer.appendChild(treePanel);
  treeContainer.appendChild(expandStrip);

  const treeResizer = document.createElement('div');
  treeResizer.className = 'tp-tree-resizer';
  treeResizer.setAttribute('role', 'separator');
  treeResizer.setAttribute('aria-orientation', 'vertical');
  treeResizer.setAttribute('aria-hidden', 'false');
  treeResizer.setAttribute('aria-label', 'Resize tree panel');
  treeResizer.tabIndex = 0;

  const beforeComponent = renderBefore ? renderBefore() : null;
  const beforePanel = beforeComponent ? document.createElement('div') : null;
  if (beforePanel && beforeComponent) {
    beforePanel.className = 'tp-panel tp-before-panel hidden';
    beforePanel.appendChild(beforeComponent.element);
  }

  const codePanel = document.createElement('div');
  codePanel.className = 'tp-panel tp-code-panel';
  const codeView = renderAfter();
  codePanel.appendChild(codeView.element);

  const markdownPanel = document.createElement('div');
  markdownPanel.className = 'tp-panel tp-markdown-panel';
  const markdownView = renderMarkdown();
  markdownPanel.appendChild(markdownView.element);

  const splitResizer = document.createElement('div');
  splitResizer.className = 'tp-split-resizer';
  splitResizer.setAttribute('role', 'separator');
  splitResizer.setAttribute('aria-orientation', 'vertical');
  splitResizer.setAttribute('aria-hidden', 'false');
  splitResizer.setAttribute('aria-label', 'Resize code and markdown views');
  splitResizer.tabIndex = 0;

  const mainSplit = document.createElement('div');
  mainSplit.className = 'tp-main-split';
  mainSplit.appendChild(codePanel);
  mainSplit.appendChild(splitResizer);
  mainSplit.appendChild(markdownPanel);

  const contentArea = document.createElement('div');
  contentArea.className = 'tp-content-area';
  contentArea.appendChild(treeContainer);
  contentArea.appendChild(treeResizer);
  if (beforePanel) {
    contentArea.appendChild(beforePanel);
  }
  contentArea.appendChild(mainSplit);

  element.appendChild(toolbar.element);
  element.appendChild(contentArea);

  let currentTreeWidth = clamp(
    readNumberFromSession(storageKeys.treeWidth) ?? TREE_DEFAULT_WIDTH,
    TREE_MIN_WIDTH,
    TREE_MAX_WIDTH
  );

  let currentSplitRatio = clamp(
    readNumberFromSession(storageKeys.splitRatio) ?? SPLIT_DEFAULT_RATIO,
    SPLIT_MIN_RATIO,
    SPLIT_MAX_RATIO
  );

  function applyTreeWidth(width: number): void {
    currentTreeWidth = clamp(width, TREE_MIN_WIDTH, TREE_MAX_WIDTH);
    treeContainer.style.setProperty('--tp-tree-width', `${currentTreeWidth}px`);
    treeResizer.setAttribute('aria-valuemin', TREE_MIN_WIDTH.toString());
    treeResizer.setAttribute('aria-valuemax', TREE_MAX_WIDTH.toString());
    treeResizer.setAttribute('aria-valuenow', Math.round(currentTreeWidth).toString());
  }

  function persistTreeWidth(): void {
    storeNumberInSession(storageKeys.treeWidth, Math.round(currentTreeWidth));
  }

  function applySplitRatio(ratio: number): void {
    currentSplitRatio = clamp(ratio, SPLIT_MIN_RATIO, SPLIT_MAX_RATIO);
    const percent = `${(currentSplitRatio * 100).toFixed(1)}%`;
    mainSplit.style.setProperty('--tp-code-width', percent);
    splitResizer.setAttribute('aria-valuemin', SPLIT_MIN_RATIO.toString());
    splitResizer.setAttribute('aria-valuemax', SPLIT_MAX_RATIO.toString());
    splitResizer.setAttribute('aria-valuenow', currentSplitRatio.toFixed(2));
  }

  function persistSplitRatio(): void {
    storeNumberInSession(storageKeys.splitRatio, Number(currentSplitRatio.toFixed(3)));
  }

  function updateTreeResizerState(collapsed: boolean): void {
    treeResizer.classList.toggle('tp-tree-resizer--hidden', collapsed);
    treeResizer.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
    treeResizer.tabIndex = collapsed ? -1 : 0;
  }

  applyTreeWidth(currentTreeWidth);
  applySplitRatio(currentSplitRatio);
  updateTreeResizerState(false);

  const onTreeResizerPointerDown = (event: PointerEvent): void => {
    if (treeContainer.classList.contains('tp-tree-container--collapsed')) {
      return;
    }

    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = currentTreeWidth;

    treeResizer.classList.add('tp-tree-resizer--active');
    treeResizer.setPointerCapture(pointerId);

    const handleMove = (moveEvent: PointerEvent): void => {
      const delta = moveEvent.clientX - startX;
      applyTreeWidth(startWidth + delta);
    };

    const handleUp = (): void => {
      treeResizer.classList.remove('tp-tree-resizer--active');
      try {
        treeResizer.releasePointerCapture(pointerId);
      } catch {
        // ignore release errors
      }
      treeResizer.removeEventListener('pointermove', handleMove);
      treeResizer.removeEventListener('pointerup', handleUp);
      treeResizer.removeEventListener('pointercancel', handleUp);
      persistTreeWidth();
    };

    treeResizer.addEventListener('pointermove', handleMove);
    treeResizer.addEventListener('pointerup', handleUp);
    treeResizer.addEventListener('pointercancel', handleUp);
  };

  const onTreeResizerKeyDown = (event: KeyboardEvent): void => {
    if (treeContainer.classList.contains('tp-tree-container--collapsed')) {
      return;
    }

    const step = event.shiftKey ? 40 : 16;
    let handled = false;

    switch (event.key) {
      case 'ArrowLeft':
        applyTreeWidth(currentTreeWidth - step);
        handled = true;
        break;
      case 'ArrowRight':
        applyTreeWidth(currentTreeWidth + step);
        handled = true;
        break;
      case 'Home':
        applyTreeWidth(TREE_MIN_WIDTH);
        handled = true;
        break;
      case 'End':
        applyTreeWidth(TREE_MAX_WIDTH);
        handled = true;
        break;
      default:
        break;
    }

    if (handled) {
      event.preventDefault();
      persistTreeWidth();
    }
  };

  const onSplitResizerPointerDown = (event: PointerEvent): void => {
    if (currentViewMode !== 'split') {
      return;
    }

    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const containerRect = mainSplit.getBoundingClientRect();
    const startRatio = currentSplitRatio;

    if (containerRect.width <= 0) {
      return;
    }

    splitResizer.classList.add('tp-split-resizer--active');
    splitResizer.setPointerCapture(pointerId);

    const handleMove = (moveEvent: PointerEvent): void => {
      const delta = moveEvent.clientX - startX;
      const nextRatio = startRatio + delta / containerRect.width;
      applySplitRatio(nextRatio);
    };

    const handleUp = (): void => {
      splitResizer.classList.remove('tp-split-resizer--active');
      try {
        splitResizer.releasePointerCapture(pointerId);
      } catch {
        // ignore release errors
      }
      splitResizer.removeEventListener('pointermove', handleMove);
      splitResizer.removeEventListener('pointerup', handleUp);
      splitResizer.removeEventListener('pointercancel', handleUp);
      persistSplitRatio();
    };

    splitResizer.addEventListener('pointermove', handleMove);
    splitResizer.addEventListener('pointerup', handleUp);
    splitResizer.addEventListener('pointercancel', handleUp);
  };

  const onSplitResizerKeyDown = (event: KeyboardEvent): void => {
    if (currentViewMode !== 'split') {
      return;
    }

    const step = event.shiftKey ? 0.1 : 0.05;
    let handled = false;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        applySplitRatio(currentSplitRatio - step);
        handled = true;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        applySplitRatio(currentSplitRatio + step);
        handled = true;
        break;
      case 'Home':
        applySplitRatio(SPLIT_MIN_RATIO);
        handled = true;
        break;
      case 'End':
        applySplitRatio(SPLIT_MAX_RATIO);
        handled = true;
        break;
      default:
        break;
    }

    if (handled) {
      event.preventDefault();
      persistSplitRatio();
    }
  };

  treeResizer.addEventListener('pointerdown', onTreeResizerPointerDown);
  treeResizer.addEventListener('keydown', onTreeResizerKeyDown);
  splitResizer.addEventListener('pointerdown', onSplitResizerPointerDown);
  splitResizer.addEventListener('keydown', onSplitResizerKeyDown);

  let currentViewMode: ViewMode = defaultViewMode;

  function setViewMode(mode: ViewMode): void {
    currentViewMode = mode;

    const isCodeOnly = mode === 'code';
    const isMarkdownOnly = mode === 'markdown';
    const isSplit = mode === 'split';

    codePanel.classList.toggle('hidden', isMarkdownOnly);
    markdownPanel.classList.toggle('hidden', isCodeOnly);

    mainSplit.classList.toggle('tp-main-split--code-only', isCodeOnly);
    mainSplit.classList.toggle('tp-main-split--markdown-only', isMarkdownOnly);
    mainSplit.classList.toggle('tp-main-split--split', isSplit);

    splitResizer.classList.toggle('tp-split-resizer--hidden', !isSplit);
    splitResizer.setAttribute('aria-hidden', isSplit ? 'false' : 'true');
    splitResizer.tabIndex = isSplit ? 0 : -1;

    updateToolbarMode(toolbar.element, mode);
  }

  const collapseTreePanel = (): void => {
    treeContainer.classList.add('tp-tree-container--collapsed');
    expandStrip.classList.add('tp-tree-expand-strip--visible');
    treeResizer.classList.remove('tp-tree-resizer--active');
    updateTreeResizerState(true);
    storeBooleanInSession(storageKeys.treeCollapsed, true);
    onTreeCollapse?.();
  };

  const expandTreePanel = (): void => {
    treeContainer.classList.remove('tp-tree-container--collapsed');
    expandStrip.classList.remove('tp-tree-expand-strip--visible');
    updateTreeResizerState(false);
    applyTreeWidth(currentTreeWidth);
    storeBooleanInSession(storageKeys.treeCollapsed, false);
    onTreeExpand?.();
  };

  expandStrip.addEventListener('click', () => expandTreePanel());

  treePanel.addEventListener('transitionend', () => {
    // Persist width when transition completes to capture CSS-driven adjustments
    persistTreeWidth();
  });

  if (shouldCollapseTreePanel(storageKeys.treeCollapsed)) {
    collapseTreePanel();
  } else {
    expandTreePanel();
  }

  setViewMode(currentViewMode);

  return {
    element,
    toolbar: toolbar.element,
    contentArea,
    treePanel,
    beforePanel,
    codePanel,
    markdownPanel,
    treeContainer,
    mainSplit,
    treeResizer,
    splitResizer,
    viewMode: currentViewMode,
    setViewMode,
    setBeforeVisible(visible: boolean): void {
      if (!beforePanel) {
        return;
      }
      beforePanel.classList.toggle('hidden', !visible);
    },
    collapseTree(): void {
      collapseTreePanel();
    },
    expandTree(): void {
      expandTreePanel();
    },
    destroy(): void {
      treeResizer.removeEventListener('pointerdown', onTreeResizerPointerDown);
      treeResizer.removeEventListener('keydown', onTreeResizerKeyDown);
      splitResizer.removeEventListener('pointerdown', onSplitResizerPointerDown);
      splitResizer.removeEventListener('keydown', onSplitResizerKeyDown);
      expandStrip.remove();
      treeView.destroy();
      codeView.destroy();
      markdownView.destroy();
      beforeComponent?.destroy();
      toolbar.destroy();
      element.remove();
    },
  };
}

function clamp(value: number, minValue: number, maxValue: number): number {
  if (value < minValue) {
    return minValue;
  }
  if (value > maxValue) {
    return maxValue;
  }
  return value;
}

function readNumberFromSession(key: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) {
      return null;
    }
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function storeNumberInSession(key: string, value: number): void {
  try {
    window.sessionStorage.setItem(key, value.toString());
  } catch {
    // ignore storage errors
  }
}

function storeBooleanInSession(key: string, value: boolean): void {
  try {
    window.sessionStorage.setItem(key, value ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

function shouldCollapseTreePanel(storageKey: string): boolean {
  try {
    return window.sessionStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}
