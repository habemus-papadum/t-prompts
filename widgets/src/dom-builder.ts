/**
 * DOM builder helper functions for creating elements with attributes.
 *
 * These helpers provide a clean API for creating DOM elements without JSX,
 * while maintaining type safety and explicit control over element creation.
 */

/**
 * Create a span element with attributes and children
 */
export function createSpan(
  attrs: Record<string, string>,
  ...children: (HTMLElement | Text | string)[]
): HTMLSpanElement {
  const span = document.createElement('span');

  // Set attributes
  Object.entries(attrs).forEach(([key, value]) => {
    span.setAttribute(key, value);
  });

  // Add children
  children.forEach(child => {
    if (typeof child === 'string') {
      span.appendChild(document.createTextNode(child));
    } else {
      span.appendChild(child);
    }
  });

  return span;
}

/**
 * Create a div element with attributes and children
 */
export function createDiv(
  attrs: Record<string, string>,
  ...children: (HTMLElement | Text | string)[]
): HTMLDivElement {
  const div = document.createElement('div');

  // Set attributes
  Object.entries(attrs).forEach(([key, value]) => {
    div.setAttribute(key, value);
  });

  // Add children
  children.forEach(child => {
    if (typeof child === 'string') {
      div.appendChild(document.createTextNode(child));
    } else {
      div.appendChild(child);
    }
  });

  return div;
}

/**
 * Create an image element with attributes and source
 */
export function createImage(
  attrs: Record<string, string>,
  src: string
): HTMLImageElement {
  const img = document.createElement('img');
  img.src = src;

  // Set attributes
  Object.entries(attrs).forEach(([key, value]) => {
    img.setAttribute(key, value);
  });

  return img;
}

/**
 * Create a text node
 */
export function createText(text: string): Text {
  return document.createTextNode(text);
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
