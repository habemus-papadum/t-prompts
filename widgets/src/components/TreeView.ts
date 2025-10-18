/**
 * TreeView Component
 *
 * Renders the prompt element hierarchy with per-element visibility controls.
 * Phase 2 integrates visibility meters and folding controller updates.
 */

import type { Component } from './base';
import type { WidgetData, WidgetMetadata, ElementData, ChunkSize } from '../types';
import type { FoldingController, FoldingClient } from '../folding/controller';
import { createVisibilityMeter, type VisibilityMeter } from './VisibilityMeter';

export interface TreeView extends Component {
  element: HTMLElement;
  update(): void;
}

interface TreeViewOptions {
  data: WidgetData;
  metadata: WidgetMetadata;
  foldingController: FoldingController;
  onCollapse?: () => void;
}

interface ElementTreeNode {
  id: string;
  type: string;
  key: string;
  ownChunkIds: string[];
  allChunkIds: string[];
  totalCharacters: number;
  totalPixels: number;
  children: ElementTreeNode[];
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

export function buildTreeView(options: TreeViewOptions): TreeView {
  const { data, metadata, foldingController, onCollapse } = options;
  const chunkSizeMap = metadata.chunkSizeMap ?? {};
  const treeShowWhitespace = data.config?.treeShowWhitespace ?? 'default';

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

  const elementTree = buildElementTree(data, chunkSizeMap, treeShowWhitespace);
  const flatItems: TreeItemComponent[] = [];

  for (const node of elementTree) {
    const item = createTreeItem(node, 0, chunkSizeMap, foldingController);
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

  return {
    element: rootElement,
    update,

    destroy(): void {
      rootElement.remove();
      flatItems.length = 0;
      foldingController.removeClient(foldingClient);
    },
  };
}

function buildElementTree(
  data: WidgetData,
  chunkSizeMap: Record<string, ChunkSize>,
  treeShowWhitespace: 'default' | 'always' | 'never'
): ElementTreeNode[] {
  const rootElements = data.source_prompt?.children ?? [];
  const chunks = data.ir?.chunks ?? [];
  const chunkMap = new Map<string, string[]>();
  const chunkTextMap = new Map<string, string>();

  for (const chunk of chunks) {
    if (!chunk.element_id) {
      continue;
    }
    if (!chunkMap.has(chunk.element_id)) {
      chunkMap.set(chunk.element_id, []);
    }
    chunkMap.get(chunk.element_id)!.push(chunk.id);

    // Store chunk text for static elements
    if (chunk.text !== undefined) {
      chunkTextMap.set(chunk.id, chunk.text);
    }
  }

  function visit(element: ElementData): ElementTreeNode | null {
    const ownChunkIds = chunkMap.get(element.id) ?? [];

    // For static elements, use the text content as the key
    let key: string;
    if (element.type === 'static' && ownChunkIds.length > 0) {
      // Concatenate all chunk texts for this element
      const texts = ownChunkIds
        .map(chunkId => chunkTextMap.get(chunkId) ?? '')
        .filter(text => text !== undefined);
      const fullText = texts.join('');

      // Check if this is whitespace-only
      const isWhitespaceOnly = fullText.trim().length === 0;

      if (isWhitespaceOnly) {
        // Handle based on config
        if (treeShowWhitespace === 'never') {
          return null; // Exclude from tree
        } else if (treeShowWhitespace === 'default' && fullText.length > 0) {
          return null; // Exclude whitespace-only by default
        }

        // Render whitespace with special characters
        key = renderWhitespace(fullText);
      } else {
        key = fullText || String(element.key);
      }
    } else {
      key = String(element.key);
    }

    const children = (element.children ?? [])
      .map((child) => visit(child))
      .filter((node): node is ElementTreeNode => node !== null);

    const allChunkIdSet = new Set<string>(ownChunkIds);
    for (const child of children) {
      for (const childChunkId of child.allChunkIds) {
        allChunkIdSet.add(childChunkId);
      }
    }

    let totalCharacters = 0;
    let totalPixels = 0;
    for (const chunkId of allChunkIdSet) {
      const size = chunkSizeMap[chunkId];
      if (!size) {
        continue;
      }
      totalCharacters += size.character ?? 0;
      totalPixels += size.pixel ?? 0;
    }

    // Filter out static elements with zero content by default
    if (element.type === 'static' && treeShowWhitespace !== 'always' && totalCharacters === 0 && totalPixels === 0) {
      return null;
    }

    return {
      id: element.id,
      type: element.type,
      key,
      ownChunkIds,
      allChunkIds: Array.from(allChunkIdSet),
      totalCharacters,
      totalPixels,
      children,
    };
  }

  return rootElements
    .map((element) => visit(element))
    .filter((node): node is ElementTreeNode => node !== null);
}

/**
 * Render whitespace with visual indicators:
 * - ¶ for newlines
 * - □ for spaces
 * - Empty string gets special indicator
 */
function renderWhitespace(text: string): string {
  if (text.length === 0) {
    return '(empty)';
  }

  return text
    .replace(/\n/g, '¶')
    .replace(/ /g, '□')
    .replace(/\t/g, '⇥');
}

function createTreeItem(
  node: ElementTreeNode,
  depth: number,
  chunkSizeMap: Record<string, ChunkSize>,
  foldingController: FoldingController
): TreeItemComponent {
  const element = document.createElement('div');
  element.className = 'tp-tree-item tp-tree-item--collapsed';
  element.style.setProperty('--tp-tree-depth', depth.toString());

  const row = document.createElement('div');
  row.className = 'tp-tree-row';
  element.appendChild(row);

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
    const childItem = createTreeItem(child, depth + 1, chunkSizeMap, foldingController);
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

  row.addEventListener('click', () => {
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
