/**
 * Widget Container Component
 *
 * Top-level container that orchestrates multiple views and toolbars.
 * Currently contains just CodeView, but designed to support:
 * - Toolbar for view switching and controls
 * - Multiple visualization views (tree, table, etc.)
 */

import type { Component } from './base';
import type { WidgetData, WidgetMetadata, ViewMode } from '../types';
import { buildTreeView } from './TreeView';
import { buildCodeView } from './CodeView';
import { buildMarkdownView } from './MarkdownView';
import { FoldingController } from '../folding/controller';
import { createToolbar, updateToolbarMode } from './Toolbar';
import type { ToolbarComponent } from './Toolbar';

/**
 * Widget container component interface
 */
export interface WidgetContainer extends Component {
  // Container-specific
  views: Component[]; // Child components
  toolbar: HTMLElement;
  contentArea: HTMLElement;
  foldingController: FoldingController; // Exposed for testing
  viewMode: ViewMode; // Current view mode

  // Operations
  setViewMode(mode: ViewMode): void;
}

/**
 * Build a WidgetContainer component from widget data and metadata
 */
export function buildWidgetContainer(data: WidgetData, metadata: WidgetMetadata): WidgetContainer {
  // 1. Create root element
  const element = document.createElement('div');
  element.className = 'tp-widget-output';

  // 2. Initialize folding controller with chunk sequence
  const initialChunkIds = data.ir?.chunks?.map((chunk) => chunk.id) || [];
  const foldingController = new FoldingController(initialChunkIds);

  const chunkSizeMap = metadata.chunkSizeMap;
  let totalCharacters = 0;
  let totalPixels = 0;
  for (const chunkId of initialChunkIds) {
    const size = chunkSizeMap[chunkId];
    if (!size) {
      continue;
    }
    totalCharacters += size.character ?? 0;
    totalPixels += size.pixel ?? 0;
  }

  const treeStorageKey = `tp-tree-collapsed:${data.compiled_ir?.ir_id ?? 'default'}`;

  // 3. Build views
  const treeContainer = document.createElement('div');
  treeContainer.className = 'tp-tree-container';

  const expandStrip = document.createElement('button');
  expandStrip.type = 'button';
  expandStrip.className = 'tp-tree-expand-strip';
  expandStrip.textContent = '▸';
  expandStrip.setAttribute('aria-label', 'Show tree view');

  let collapseTreePanel: () => void = () => {};
  let expandTreePanel: () => void = () => {};

  const treeView = buildTreeView({
    data,
    metadata,
    foldingController,
    onCollapse: () => collapseTreePanel(),
  });

  const treePanel = document.createElement('div');
  treePanel.className = 'tp-panel tp-tree-panel';
  treePanel.appendChild(treeView.element);

  treeContainer.appendChild(treePanel);
  treeContainer.appendChild(expandStrip);

  const codeView = buildCodeView(data, metadata, foldingController);
  const markdownView = buildMarkdownView(data, metadata, foldingController);

  // 4. Create panels
  const codePanel = document.createElement('div');
  codePanel.className = 'tp-panel tp-code-panel';
  codePanel.appendChild(codeView.element);

  const markdownPanel = document.createElement('div');
  markdownPanel.className = 'tp-panel tp-markdown-panel';
  markdownPanel.appendChild(markdownView.element);

  // 5. Create content area
  const contentArea = document.createElement('div');
  contentArea.className = 'tp-content-area';
  contentArea.appendChild(treeContainer);
  contentArea.appendChild(codePanel);
  contentArea.appendChild(markdownPanel);

  // 6. State management
  let currentViewMode: ViewMode = 'split';

  // 7. View mode setter
  function setViewMode(mode: ViewMode): void {
    currentViewMode = mode;

    // Update panel visibility
    if (mode === 'code') {
      codePanel.classList.remove('hidden');
      markdownPanel.classList.add('hidden');
    } else if (mode === 'markdown') {
      codePanel.classList.add('hidden');
      markdownPanel.classList.remove('hidden');
    } else {
      // split
      codePanel.classList.remove('hidden');
      markdownPanel.classList.remove('hidden');
    }

    // Update toolbar active state
    updateToolbarMode(toolbar, mode);
  }

  // 8. Create toolbar
  const toolbarComponent: ToolbarComponent = createToolbar({
    currentMode: currentViewMode,
    callbacks: {
      onViewModeChange: setViewMode,
    },
    foldingController,
    metrics: {
      totalCharacters,
      totalPixels,
      chunkIds: initialChunkIds,
      chunkSizeMap,
    },
  });
  const toolbar = toolbarComponent.element;

  // 9. Assemble
  element.appendChild(toolbar);
  element.appendChild(contentArea);

  // 10. Initialize view mode
  setViewMode(currentViewMode);

  // 11. Track views
  const views: Component[] = [treeView, codeView, markdownView];

  expandStrip.addEventListener('click', () => expandTreePanel());

  collapseTreePanel = (): void => {
    treeContainer.classList.add('tp-tree-container--collapsed');
    expandStrip.classList.add('tp-tree-expand-strip--visible');
    try {
      window.sessionStorage.setItem(treeStorageKey, '1');
    } catch {
      // ignore storage errors (e.g., sandboxed environments)
    }
  };

  expandTreePanel = (): void => {
    treeContainer.classList.remove('tp-tree-container--collapsed');
    expandStrip.classList.remove('tp-tree-expand-strip--visible');
    try {
      window.sessionStorage.setItem(treeStorageKey, '0');
    } catch {
      // ignore storage errors
    }
  };

  if (shouldCollapseTreePanel(treeStorageKey)) {
    collapseTreePanel();
  } else {
    expandTreePanel();
  }

  // 12. Return component
  return {
    element,
    views,
    toolbar,
    contentArea,
    foldingController,
    viewMode: currentViewMode,

    setViewMode,

    destroy(): void {
      // Cleanup all views
      views.forEach((view) => view.destroy());
      toolbarComponent.destroy();
      element.remove();
    },
  };
}

function shouldCollapseTreePanel(storageKey: string): boolean {
  try {
    return window.sessionStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}
