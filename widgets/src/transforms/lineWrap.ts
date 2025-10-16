/**
 * Line Wrap Transform
 *
 * Implements terminal-style fixed-column text wrapping.
 * Wraps text at column boundaries (not word boundaries) and creates
 * a right-leaning tree structure for multi-wrap scenarios.
 */

import type { TransformState } from './base';
import { replaceInChunksMap } from './base';

const DEFAULT_COLUMN_LIMIT = 100;

/**
 * Copy all data-* attributes from one element to another
 */
function copyDataAttributes(fromElement: HTMLElement, toElement: HTMLElement): void {
  for (const key in fromElement.dataset) {
    toElement.dataset[key] = fromElement.dataset[key]!;
  }
}

/**
 * Copy classes from one element to another
 */
function copyClasses(fromElement: HTMLElement, toElement: HTMLElement): void {
  if (fromElement.className) {
    toElement.className = fromElement.className;
  }
}

/**
 * Wrap an element that needs to be split at a column boundary.
 * Creates a container with the first part, a line break, and recursively
 * processes the rest.
 *
 * @param element - The element to wrap
 * @param splitIndex - Character index where to split the text
 * @param columnLimit - Maximum columns per line
 * @param chunks - Chunks map for tracking
 * @returns The new container element
 */
function wrapElement(
  element: HTMLElement,
  splitIndex: number,
  columnLimit: number,
  chunks: Map<string, HTMLElement[]>
): HTMLElement {
  const text = element.textContent || '';

  // Split the text
  const firstPart = text.substring(0, splitIndex);
  const remainder = text.substring(splitIndex);

  // Create container that will replace the original element
  const container = document.createElement('span');
  copyDataAttributes(element, container);
  copyClasses(element, container);
  container.classList.add('tp-wrap-container');

  // Create span for first part (no special classes, just copy originals)
  const firstSpan = document.createElement('span');
  copyDataAttributes(element, firstSpan);
  copyClasses(element, firstSpan);
  firstSpan.textContent = firstPart;

  // Create line break
  const lineBreak = document.createElement('br');
  lineBreak.className = 'tp-wrap-newline';

  // Create span for remainder - only child spans get continuation class, not containers
  const remainderSpan = document.createElement('span');
  copyDataAttributes(element, remainderSpan);
  copyClasses(element, remainderSpan);
  remainderSpan.textContent = remainder;

  // Check if remainder needs further wrapping
  if (remainder.length > columnLimit) {
    // Recursively wrap the remainder
    const wrappedRemainder = wrapElement(remainderSpan, columnLimit, columnLimit, chunks);
    // Mark the wrapped remainder as continuation (not the leaf spans)
    wrappedRemainder.classList.add('tp-wrap-continuation');
    container.appendChild(firstSpan);
    container.appendChild(lineBreak);
    container.appendChild(wrappedRemainder);
  } else {
    // No further wrapping needed - mark this leaf span as continuation
    remainderSpan.classList.add('tp-wrap-continuation');
    container.appendChild(firstSpan);
    container.appendChild(lineBreak);
    container.appendChild(remainderSpan);
  }

  // Copy special data (like _imageData) from original element to container
  const elementWithImageData = element as HTMLElement & { _imageData?: any };
  if (elementWithImageData._imageData) {
    (container as typeof elementWithImageData)._imageData = elementWithImageData._imageData;
  }

  return container;
}

/**
 * Process a single element for wrapping.
 * Returns the element to continue processing from (rightmost child if wrapped).
 */
function processElement(
  element: HTMLElement,
  currentColumn: number,
  columnLimit: number,
  chunks: Map<string, HTMLElement[]>
): { nextElement: HTMLElement | null; newColumn: number } {
  const text = element.textContent || '';
  const textLength = text.length;

  // Check if this element would exceed the column limit
  if (currentColumn + textLength > columnLimit) {
    // Need to wrap
    const availableColumns = columnLimit - currentColumn;
    const splitIndex = availableColumns > 0 ? availableColumns : columnLimit;

    // Create wrapped structure
    const container = wrapElement(element, splitIndex, columnLimit, chunks);

    // Replace in DOM
    if (element.parentNode) {
      element.parentNode.replaceChild(container, element);
    }

    // Replace in chunks map (if this element was tracked)
    replaceInChunksMap(element, container, chunks);

    // Find the rightmost child (last continuation span)
    let rightmost = container;
    while (rightmost.lastElementChild && rightmost.lastElementChild instanceof HTMLElement) {
      const lastChild = rightmost.lastElementChild;
      // Skip line breaks
      if (lastChild.className === 'tp-wrap-newline') {
        // Check second-to-last child
        const prevSibling = lastChild.previousElementSibling;
        if (prevSibling instanceof HTMLElement) {
          rightmost = prevSibling;
          break;
        }
        break;
      }
      rightmost = lastChild;
    }

    // The rightmost element determines our new column position
    const rightmostText = rightmost.textContent || '';
    return { nextElement: rightmost.nextElementSibling as HTMLElement | null, newColumn: rightmostText.length };
  }

  // No wrapping needed, advance column counter
  return { nextElement: element.nextElementSibling as HTMLElement | null, newColumn: currentColumn + textLength };
}

/**
 * Apply line wrapping transform to all elements
 */
export function applyTransform_LineWrap(
  state: TransformState,
  columnLimit: number = DEFAULT_COLUMN_LIMIT
): TransformState {
  const { element, chunks } = state;

  let currentColumn = 0;
  let currentElement = element.firstElementChild as HTMLElement | null;

  while (currentElement) {
    // Check if this is a line break element (resets column)
    if (currentElement.tagName === 'BR') {
      currentColumn = 0;
      currentElement = currentElement.nextElementSibling as HTMLElement | null;
      continue;
    }

    // Skip non-text elements
    if (!currentElement.textContent) {
      currentElement = currentElement.nextElementSibling as HTMLElement | null;
      continue;
    }

    // Process this element
    const result = processElement(currentElement, currentColumn, columnLimit, chunks);
    currentColumn = result.newColumn;
    currentElement = result.nextElement;
  }

  return state;
}

/**
 * Reverse line wrapping by unwrapping all tp-wrap-container elements
 *
 * This function:
 * 1. Finds all .tp-wrap-container elements
 * 2. Collects all text from children (excluding <br> elements)
 * 3. Replaces container with a single span containing the concatenated text
 * 4. Preserves data attributes and original classes (minus wrap-related ones)
 *
 * @param element - The container element to unwrap within
 * @param chunks - The chunks map to update
 */
export function unwrapLineWrapping(element: HTMLElement, chunks: Map<string, HTMLElement[]>): void {
  // Find all wrap containers (process from deepest to shallowest to handle nested wraps)
  const containers = Array.from(element.querySelectorAll('.tp-wrap-container'));

  // Process in reverse order to handle nested containers correctly
  for (let i = containers.length - 1; i >= 0; i--) {
    const container = containers[i] as HTMLElement;

    // Collect all text from this container (excluding line breaks)
    let fullText = '';
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      fullText += node.textContent;
    }

    // Create replacement span with the full text
    const replacement = document.createElement('span');

    // Copy data attributes from container
    for (const key in container.dataset) {
      replacement.dataset[key] = container.dataset[key]!;
    }

    // Copy classes from container, but remove wrap-related classes
    const classesToCopy = container.className
      .split(' ')
      .filter(c => c !== 'tp-wrap-container' && c !== 'tp-wrap-continuation');
    replacement.className = classesToCopy.join(' ');

    // Set the text content
    replacement.textContent = fullText;

    // Copy special data (like _imageData)
    const containerWithImageData = container as HTMLElement & { _imageData?: any };
    if (containerWithImageData._imageData) {
      (replacement as typeof containerWithImageData)._imageData = containerWithImageData._imageData;
    }

    // Replace in DOM
    if (container.parentNode) {
      container.parentNode.replaceChild(replacement, container);
    }

    // Replace in chunks map (if this container was tracked)
    replaceInChunksMap(container, replacement, chunks);
  }

  // Also remove any standalone tp-wrap-continuation classes and tp-wrap-newline elements
  const continuations = Array.from(element.querySelectorAll('.tp-wrap-continuation'));
  for (const elem of continuations) {
    elem.classList.remove('tp-wrap-continuation');
  }

  const lineBreaks = Array.from(element.querySelectorAll('.tp-wrap-newline'));
  for (const br of lineBreaks) {
    br.remove();
  }
}
