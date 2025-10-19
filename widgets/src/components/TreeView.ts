/**
 * TreeView Component
 *
 * Renders the prompt element hierarchy with per-element visibility controls.
 * Phase 2 integrates visibility meters and folding controller updates.
 */

import type { Component } from './base';
import type { WidgetData, WidgetMetadata, ChunkSize } from '../types';
import type { FoldingController } from '../folding/controller';
import type { FoldingClient } from '../folding/types';
import { createVisibilityMeter, type VisibilityMeter } from './VisibilityMeter';
import {
  activateChunkNavigation,
  isPrimaryModifierActive,
  type NavigationActivation,
} from '../utils/chunkNavigation';
import type { TreeDataSource, TreeNodeDescriptor } from './treeDataSource';

export interface TreeView extends Component {
  element: HTMLElement;
  update(): void;
}

interface TreeViewOptions {
  data: WidgetData;
  metadata: WidgetMetadata;
  foldingController: FoldingController;
  onCollapse?: () => void;
  dataSource: TreeDataSource;
  overlays?: TreeOverlay[];
}

interface TreeItemComponent {
  element: HTMLDivElement;
  toggleButton: HTMLButtonElement | null;
  childrenContainer: HTMLDivElement | null;
  childItems: TreeItemComponent[];
  expanded: boolean;
  node: ElementTreeNode;
  visibilityMeter: VisibilityMeter;
  updateVisibility(): void;
  toggle(): void;
}

const ICON_FOR_TYPE: Record<string, string> = {
  static: '▪',
  interpolation: '◆',
  nested_prompt: '▣',
  list: '≡',
  image: '▢',
};

const MAX_KEY_LENGTH = 15;

export interface TreeOverlay {
  decorate?(node: TreeNodeDescriptor, row: HTMLElement): void;
}

export function buildTreeView(options: TreeViewOptions): TreeView {
  const { data, metadata, foldingController, onCollapse, dataSource, overlays = [] } = options;
  const chunkSizeMap = metadata.chunkSizeMap ?? {};

  const rootElement = document.createElement('div');
  rootElement.className = 'tp-tree-view';

  const header = document.createElement('div');
  header.className = 'tp-tree-header';

  const title = document.createElement('span');
  title.className = 'tp-tree-title';
  title.textContent = 'Structure';
  header.appendChild(title);

  const collapseButton = document.createElement('button');
  collapseButton.type = 'button';
  collapseButton.className = 'tp-tree-collapse-btn';
  collapseButton.textContent = '«';
  collapseButton.addEventListener('click', () => {
    if (onCollapse) {
      onCollapse();
    }
  });
  header.appendChild(collapseButton);

  rootElement.appendChild(header);

  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'tp-tree-items';
  rootElement.appendChild(itemsContainer);

  const elementTree = dataSource.getRoots();
  const flatItems: TreeItemComponent[] = [];

  for (const node of elementTree) {
    const item = createTreeItem(node, 0, chunkSizeMap, foldingController, overlays);
    collectItems(item, flatItems);
    itemsContainer.appendChild(item.element);
  }

  const foldingClient: FoldingClient = {
    onStateChanged(): void {
      update();
    },
  };

  foldingController.addClient(foldingClient);

  function update(): void {
    for (const item of flatItems) {
      item.updateVisibility();
    }
  }

  update();

  const navigationActivation: NavigationActivation | undefined = activateChunkNavigation(rootElement, {
    enable: data.config?.enableEditorLinks ?? true,
    chunkTargets: metadata.chunkLocationMap,
    elementTargets: metadata.elementLocationDetails,
  });

  return {
    element: rootElement,
    update,

    destroy(): void {
      rootElement.remove();
      flatItems.length = 0;
      foldingController.removeClient(foldingClient);
      navigationActivation?.disconnect();
    },
  };
}

function createTreeItem(
  node: TreeNodeDescriptor,
  depth: number,
  chunkSizeMap: Record<string, ChunkSize>,
  foldingController: FoldingController,
  overlays: TreeOverlay[]
): TreeItemComponent {
  const element = document.createElement('div');
  element.className = 'tp-tree-item tp-tree-item--collapsed';
  element.style.setProperty('--tp-tree-depth', depth.toString());

  const row = document.createElement('div');
  row.className = 'tp-tree-row';
  row.setAttribute('data-element-id', node.id);
  element.appendChild(row);

  for (const overlay of overlays) {
    overlay.decorate?.(node, row);
  }

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'tp-tree-toggle';
  toggleButton.textContent = node.children.length > 0 ? '▸' : '';
  toggleButton.disabled = node.children.length === 0;
  row.appendChild(toggleButton);

  const icon = document.createElement('span');
  icon.className = `tp-tree-icon tp-tree-icon--${node.type || 'unknown'}`;
  icon.textContent = ICON_FOR_TYPE[node.type] ?? '?';
  row.appendChild(icon);

  const keySpan = document.createElement('span');
  keySpan.className = 'tp-tree-key';
  keySpan.textContent = elideKey(node.key);
  row.appendChild(keySpan);

  const visibilityMeter = createVisibilityMeter({
    totalCharacters: node.totalCharacters,
    totalPixels: node.totalPixels,
    showCharacterText: true,
    showPixelText: true,
    showCharacterPie: true,
    showPixelPie: true,
  });
  visibilityMeter.element.classList.add('tp-tree-meter');
  row.appendChild(visibilityMeter.element);

  const childrenContainer = document.createElement('div');
  childrenContainer.className = 'tp-tree-children';
  element.appendChild(childrenContainer);

  const childItems = node.children.map((child) => {
    const childItem = createTreeItem(child, depth + 1, chunkSizeMap, foldingController, overlays);
    childrenContainer.appendChild(childItem.element);
    return childItem;
  });

  const item: TreeItemComponent = {
    element,
    toggleButton: node.children.length > 0 ? toggleButton : null,
    childrenContainer,
    childItems,
    expanded: false, // Start collapsed by default
    node,
    visibilityMeter,
    updateVisibility(): void {
      const { characters, pixels } = calculateVisibleMetrics(node.allChunkIds, chunkSizeMap, foldingController);
      visibilityMeter.update(characters, pixels);
      for (const childItem of childItems) {
        childItem.updateVisibility();
      }
    },
    toggle(): void {
      item.expanded = !item.expanded;
      if (item.expanded) {
        element.classList.add('tp-tree-item--expanded');
        element.classList.remove('tp-tree-item--collapsed');
        if (item.toggleButton) {
          item.toggleButton.textContent = '▾';
        }
      } else {
        element.classList.remove('tp-tree-item--expanded');
        element.classList.add('tp-tree-item--collapsed');
        if (item.toggleButton) {
          item.toggleButton.textContent = '▸';
        }
      }
    },
  };

  if (item.toggleButton) {
    item.toggleButton.addEventListener('click', (event) => {
      event.stopPropagation();
      item.toggle();
    });
  }

  // Track pending single-click to debounce against double-click
  let clickTimeout: number | null = null;

  row.addEventListener('click', (event) => {
    if (isPrimaryModifierActive(event)) {
      return;
    }

    if (node.children.length === 0) {
      return;
    }

    // Clear any existing timeout
    if (clickTimeout !== null) {
      clearTimeout(clickTimeout);
    }

    // Set timeout for single-click action
    clickTimeout = window.setTimeout(() => {
      item.toggle();
      clickTimeout = null;
    }, 250);
  });

  row.addEventListener('dblclick', (event) => {
    if (isPrimaryModifierActive(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // Clear pending single-click
    if (clickTimeout !== null) {
      clearTimeout(clickTimeout);
      clickTimeout = null;
    }

    const anyVisible = node.allChunkIds.some((chunkId) => !foldingController.isCollapsed(chunkId));
    if (anyVisible) {
      collapseChunkIds(node.allChunkIds, foldingController);
    } else {
      foldingController.expandByChunkIds(node.allChunkIds);
    }
  });

  return item;
}

function elideKey(key: string): string {
  if (key.length <= MAX_KEY_LENGTH) {
    return key;
  }
  return `${key.slice(0, MAX_KEY_LENGTH - 1)}…`;
}

function collectItems(item: TreeItemComponent, target: TreeItemComponent[]): void {
  target.push(item);
  for (const child of item.childItems) {
    collectItems(child, target);
  }
}

function calculateVisibleMetrics(
  chunkIds: string[],
  chunkSizeMap: Record<string, ChunkSize>,
  foldingController: FoldingController
): { characters: number; pixels: number } {
  let characters = 0;
  let pixels = 0;

  for (const chunkId of chunkIds) {
    if (foldingController.isCollapsed(chunkId)) {
      continue;
    }

    const size = chunkSizeMap[chunkId];
    if (!size) {
      continue;
    }

    characters += size.character ?? 0;
    pixels += size.pixel ?? 0;
  }

  return { characters, pixels };
}

function collapseChunkIds(chunkIds: string[], foldingController: FoldingController): void {
  const visibleSet = new Set(foldingController.getVisibleSequence());
  const targets = chunkIds.filter((id) => visibleSet.has(id));
  if (targets.length === 0) {
    return;
  }

  foldingController.clearSelections();
  foldingController.selectByIds(targets);

  if (foldingController.getSelections().length > 0) {
    try {
      foldingController.commitSelections();
    } catch (error) {
      console.error('Failed to collapse chunk IDs', targets, error);
    }
  }
}
