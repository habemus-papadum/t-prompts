/**
 * Code View Component
 *
 * Renders text output with semantic coloring and element boundaries.
 * Uses a transform pipeline to incrementally build and annotate the DOM.
 */

import type { Component } from './base';
import type { WidgetData, WidgetMetadata } from '../types';
import type { TransformState } from '../transforms/base';
import { applyTransform_CreateChunks } from '../transforms/createChunks';
import { applyTransform_AddTyping } from '../transforms/typing';
import { applyTransform_ImageTruncate } from '../transforms/imageTruncate';
import { applyTransform_LineWrap, unwrapLineWrapping } from '../transforms/lineWrap';
import { applyTransform_ImageHoverPreview } from '../transforms/imageHoverPreview';
import { applyTransform_MarkBoundaries } from '../transforms/boundaries';
import type { FoldingController } from '../folding/controller';
import type { FoldingEvent, FoldingClient } from '../folding/types';
import { activateChunkNavigation, type NavigationActivation } from '../utils/chunkNavigation';
import type { DiffState, DiffStateSnapshot, RenderedGhostChunk } from '../state/diffState';

/**
 * Code view component interface
 */
export interface CodeView extends Component {
  // Text-specific data
  chunkIdToTopElements: Map<string, HTMLElement[]>; // chunkId → array of top-level DOM elements
}

/**
 * Build a CodeView component from widget data and metadata
 *
 * @param data - Widget data containing IR chunks
 * @param metadata - Widget metadata
 * @param foldingController - Folding controller for managing code folding state
 */
export function buildCodeView(
  data: WidgetData,
  metadata: WidgetMetadata,
  foldingController: FoldingController,
  diffState?: DiffState
): CodeView {
  // 1. Create initial DOM structure
  const element = document.createElement('div');
  element.className = 'tp-output-container wrap';

  // 2. Build chunk ID to top-level elements map
  const chunkIdToTopElements = new Map<string, HTMLElement[]>();
  const diffCallouts: HTMLElement[] = [];
  const diffGhosts: HTMLElement[] = [];
  let diffUnsubscribe: (() => void) | null = null;

  // 3. Apply transformation pipeline
  let state: TransformState = { element, chunks: chunkIdToTopElements, data, metadata };

  // Transform pipeline - each function modifies state
  state = applyTransform_CreateChunks(state);
  state = applyTransform_AddTyping(state);
  state = applyTransform_ImageTruncate(state);
  state = applyTransform_LineWrap(state);
  state = applyTransform_ImageHoverPreview(state);
  state = applyTransform_MarkBoundaries(state);

  const navigationActivation: NavigationActivation | undefined = activateChunkNavigation(element, {
    enable: data.config?.enableEditorLinks ?? true,
    chunkTargets: metadata.chunkLocationMap,
    elementTargets: metadata.elementLocationDetails,
  });

  const clearDiffDecorations = (): void => {
    for (const targets of chunkIdToTopElements.values()) {
      for (const target of targets) {
        target.classList.remove('tp-chunk--diff', 'tp-chunk--diff-insert', 'tp-chunk--diff-replace');
        target.removeAttribute('data-diff-op');
        target.removeAttribute('title');
      }
    }

    while (diffCallouts.length > 0) {
      const callout = diffCallouts.pop();
      callout?.remove();
    }

    while (diffGhosts.length > 0) {
      const ghost = diffGhosts.pop();
      ghost?.remove();
    }

    element.classList.remove('tp-output-container--diff');
  };

  const applyGhostInline = (anchor: HTMLElement, ghost: RenderedGhostChunk): void => {
    const callout = document.createElement('span');
    callout.className = 'tp-chunk-ghost-inline';
    callout.textContent = ghost.text;
    callout.setAttribute('data-diff-op', 'delete');
    callout.setAttribute('aria-label', 'Removed text');
    anchor.insertAdjacentElement('afterend', callout);
    diffCallouts.push(callout);
  };

  const applyGhostBlock = (ghost: RenderedGhostChunk): void => {
    const ghostElement = document.createElement('div');
    ghostElement.className = 'tp-chunk-ghost-block';
    ghostElement.textContent = ghost.text;
    ghostElement.setAttribute('data-diff-op', 'delete');
    ghostElement.setAttribute('aria-label', 'Removed chunk');
    ghostElement.setAttribute('data-chunk-id', ghost.chunkId);

    const anchorTargets = ghost.anchorAfterId ? chunkIdToTopElements.get(ghost.anchorAfterId) : undefined;
    const anchor = anchorTargets && anchorTargets.length > 0 ? anchorTargets[0] : null;
    if (anchor && anchor.parentElement) {
      anchor.parentElement.insertBefore(ghostElement, anchor);
    } else {
      element.appendChild(ghostElement);
    }

    diffGhosts.push(ghostElement);
  };

  const applyDiffSnapshot = (snapshot: DiffStateSnapshot | null): void => {
    clearDiffDecorations();

    const rendered = snapshot?.available && snapshot.enabled ? snapshot.rendered : undefined;
    if (!rendered) {
      return;
    }

    element.classList.add('tp-output-container--diff');

    for (const [chunkId, annotation] of rendered.chunkAnnotations.entries()) {
      const targets = chunkIdToTopElements.get(chunkId);
      if (!targets) {
        continue;
      }
      for (const target of targets) {
        target.classList.add('tp-chunk--diff');
        target.setAttribute('data-diff-op', annotation.op);
        if (annotation.op === 'insert') {
          target.classList.add('tp-chunk--diff-insert');
          target.title = 'Added chunk';
        } else if (annotation.op === 'replace') {
          target.classList.add('tp-chunk--diff-replace');
          target.title = 'Modified chunk';
        }
      }
    }

    for (const ghost of rendered.deletedChunks) {
      if (ghost.op === 'replace' && ghost.anchorAfterId) {
        const anchors = chunkIdToTopElements.get(ghost.anchorAfterId) ?? [];
        if (anchors.length === 0) {
          applyGhostBlock(ghost);
          continue;
        }
        for (const anchor of anchors) {
          applyGhostInline(anchor, ghost);
        }
        continue;
      }
      applyGhostBlock(ghost);
    }
  };


  // 4. Selection tracking with debouncing
  let selectionTimeout: ReturnType<typeof setTimeout> | null = null;
  const DOUBLE_TAP_WINDOW_MS = 350;
  let lastSpaceTapTimestamp = 0;
  let spaceTapTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleSelectionChange(): void {
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
    }

    selectionTimeout = setTimeout(() => {
      const selectedIds = getSelectedChunkIds();

      if (selectedIds.size > 0) {
        // Clear existing selections and apply new ones
        foldingController.clearSelections();
        foldingController.selectByIds(selectedIds);
      }
    }, 100);
  }

  function getSelectedChunkIds(): Set<string> {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return new Set();
    }

    const range = selection.getRangeAt(0);

    // Only process if selection is within our container
    if (!element.contains(range.commonAncestorContainer)) {
      return new Set();
    }

    const selectedIds = new Set<string>();

    // Check each chunk's top-level elements
    for (const [chunkId, elements] of chunkIdToTopElements) {
      for (const chunkElement of elements) {
        // Skip elements that are no longer in the DOM
        // (This can happen if the map has stale references after unwrap/rewrap)
        if (!document.contains(chunkElement)) {
          continue;
        }

        if (isElementInRange(chunkElement, range)) {
          selectedIds.add(chunkId);
          break; // Found one element for this chunk, that's enough
        }
      }
    }

    return selectedIds;
  }

  function isElementInRange(element: HTMLElement, range: Range): boolean {
    const elementRange = document.createRange();
    elementRange.selectNodeContents(element);

    // Check if ranges intersect
    return (
      range.compareBoundaryPoints(Range.START_TO_END, elementRange) > 0 &&
      range.compareBoundaryPoints(Range.END_TO_START, elementRange) < 0
    );
  }

  function resetSpaceTapTimer(): void {
    lastSpaceTapTimestamp = 0;
    if (spaceTapTimeout) {
      clearTimeout(spaceTapTimeout);
      spaceTapTimeout = null;
    }
  }

  function currentTimestamp(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }

  // 5. Keyboard handler for collapse / expand
  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === ' ' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      const selections = foldingController.getSelections();
      if (selections.length > 0) {
        foldingController.commitSelections();
        const domSelection = window.getSelection();
        if (domSelection && domSelection.rangeCount > 0) {
          domSelection.removeAllRanges();
          document.dispatchEvent(new Event('selectionchange'));
        }
        resetSpaceTapTimer();
        return;
      }

      const now = currentTimestamp();

      if (lastSpaceTapTimestamp > 0 && now - lastSpaceTapTimestamp <= DOUBLE_TAP_WINDOW_MS) {
        foldingController.expandAll();
        resetSpaceTapTimer();
        return;
      }

      lastSpaceTapTimestamp = now;

      if (spaceTapTimeout) {
        clearTimeout(spaceTapTimeout);
      }

      spaceTapTimeout = setTimeout(() => {
        resetSpaceTapTimer();
      }, DOUBLE_TAP_WINDOW_MS);
    }
  }

  // Make element focusable for keyboard events
  element.tabIndex = 0;

  // 6. Create folding client to respond to controller events
  const foldingClient: FoldingClient = {
    onStateChanged(event: FoldingEvent): void {
      // Handle different event types
      switch (event.type) {
        case 'selections-changed':
          // No visual feedback needed for selections
          break;
        case 'chunks-collapsed':
          handleChunksCollapsed(event.collapsedIds);
          break;
        case 'chunk-expanded':
          handleChunkExpanded(event.expandedId);
          break;
        case 'state-reset':
          handleStateReset();
          break;
      }
    },
  };

  function recomputeWrapping(): void {
    state = applyTransform_LineWrap({
      element,
      chunks: chunkIdToTopElements,
      data,
      metadata,
    });
  }

  function handleChunksCollapsed(collapsedIds: string[]): void {
    unwrapLineWrapping(element, chunkIdToTopElements);

    // 2. Process each collapsed chunk
    for (let i = 0; i < collapsedIds.length; i++) {
      const collapsedId = collapsedIds[i];
      const collapsed = foldingController.getCollapsedChunk(collapsedId);
      if (!collapsed) continue;

      // Count total characters in collapsed children
      let charCount = 0;
      let firstElement: HTMLElement | null = null;

      for (const childId of collapsed.children) {
        const childElements = chunkIdToTopElements.get(childId);
        if (childElements) {
          for (const el of childElements) {
            if (!firstElement) {
              firstElement = el;
            }
            charCount += el.textContent?.length || 0;
            el.style.display = 'none'; // Hide children
          }
        }
      }

      // Create collapsed chunk span
      const collapsedSpan = document.createElement('span');
      collapsedSpan.setAttribute('data-chunk-id', collapsedId);
      collapsedSpan.className = 'tp-chunk-collapsed';
      collapsedSpan.textContent = `[${charCount} chars]`;
      collapsedSpan.title = 'Double-click to expand';

      // Add double-click handler
      collapsedSpan.addEventListener('dblclick', () => {
        foldingController.expandChunk(collapsedId);
      });

      // Insert in DOM before the first child element
      if (firstElement && firstElement.parentNode) {
        firstElement.parentNode.insertBefore(collapsedSpan, firstElement);
      }

      // Track in chunkIdToTopElements map
      chunkIdToTopElements.set(collapsedId, [collapsedSpan]);
    }

    recomputeWrapping();

  }

  function handleChunkExpanded(expandedId: string): void {
    unwrapLineWrapping(element, chunkIdToTopElements);

    const collapsed = foldingController.getCollapsedChunk(expandedId);
    if (!collapsed) return;

    // Find the collapsed span
    const collapsedElements = chunkIdToTopElements.get(expandedId);
    if (!collapsedElements || collapsedElements.length === 0) return;

    const collapsedSpan = collapsedElements[0];

    // 2. Show all children's top-level elements
    for (const childId of collapsed.children) {
      const childElements = chunkIdToTopElements.get(childId);
      if (childElements) {
        for (const el of childElements) {
          el.style.display = ''; // Restore display
        }
      }
    }

    // Remove collapsed span from DOM and map
    collapsedSpan.remove();
    chunkIdToTopElements.delete(expandedId);

    recomputeWrapping();

  }

  function handleStateReset(): void {
    // TODO: Implement state reset handling if needed
    console.log('State reset');
  }

  // 7. Add event listeners
  document.addEventListener('selectionchange', handleSelectionChange);
  element.addEventListener('keydown', handleKeyDown);

  // 8. Register as client
  foldingController.addClient(foldingClient);

  if (diffState?.isAvailable()) {
    diffUnsubscribe = diffState.subscribe((snapshot) => {
      applyDiffSnapshot(snapshot);
    });
  }

  // 9. Return component with operations
  return {
    element: state.element,
    chunkIdToTopElements,

    destroy(): void {
      // Remove event listeners
      document.removeEventListener('selectionchange', handleSelectionChange);
      element.removeEventListener('keydown', handleKeyDown);

      // Clear any pending timeouts
      if (selectionTimeout) {
        clearTimeout(selectionTimeout);
      }

      resetSpaceTapTimer();

      // Unregister from folding controller
      foldingController.removeClient(foldingClient);

      diffUnsubscribe?.();
      clearDiffDecorations();

      // Cleanup DOM and data
      element.remove();
      chunkIdToTopElements.clear();
      navigationActivation?.disconnect();
    },
  };
}
