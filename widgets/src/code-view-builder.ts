/**
 * CodeViewBuilder - Constructs the code view DOM with element tracking
 *
 * This class builds a structured DOM representation of the code view,
 * where each element from the JSON structure gets its own span with a
 * unique ID for tracking and mapping.
 */

import { createSpan, createImage, createDiv } from './dom-builder';

/**
 * Type definitions for element data from JSON
 */
interface ElementData {
  type: string;
  id?: string;
  key?: string | number;
  value?: string;
  expression?: string;
  children?: ElementData[];
  separator?: string;
  image_data?: ImageData;
  render_hints?: string;
  [key: string]: unknown;
}

interface ImageData {
  base64_data?: string;
  format?: string;
  width?: number;
  height?: number;
  error?: string;
}

/**
 * Metadata tracked for each element
 */
interface ElementMetadata {
  element: HTMLElement;
  jsonNode: ElementData;
  type: string;
  parentId?: string;
}

/**
 * CodeViewBuilder class
 *
 * Manages construction of the code view DOM with element ID tracking.
 */
export class CodeViewBuilder {
  private container: HTMLDivElement;
  private elementMap: Map<string, ElementMetadata> = new Map();
  private currentParent: HTMLElement;

  constructor() {
    this.container = createDiv({ class: 'tp-code-view' });
    this.currentParent = this.container;
  }

  /**
   * Add an element to the map and DOM
   */
  private addElement(
    id: string,
    type: string,
    jsonNode: ElementData,
    element: HTMLElement,
    parentId?: string
  ): void {
    this.elementMap.set(id, { element, jsonNode, type, parentId });
    this.currentParent.appendChild(element);
  }

  /**
   * Add a static text element
   */
  addStatic(
    id: string,
    jsonNode: ElementData,
    text: string,
    parentId?: string
  ): HTMLSpanElement {
    const span = createSpan(
      {
        'data-element-id': id,
        'data-type': 'static',
        'data-key': String(jsonNode.key ?? ''),
      },
      text
    );

    this.addElement(id, 'static', jsonNode, span, parentId);
    return span;
  }

  /**
   * Add an interpolation element
   */
  addInterpolation(
    id: string,
    jsonNode: ElementData,
    value: string,
    parentId?: string
  ): HTMLSpanElement {
    const attrs: Record<string, string> = {
      'data-element-id': id,
      'data-type': 'interpolation',
      'data-key': String(jsonNode.key ?? ''),
    };

    if (jsonNode.expression) {
      attrs['data-expression'] = jsonNode.expression;
    }

    const span = createSpan(attrs, value);
    this.addElement(id, 'interpolation', jsonNode, span, parentId);
    return span;
  }

  /**
   * Add an image element (as thumbnail)
   */
  addImage(
    id: string,
    jsonNode: ElementData,
    imageData: ImageData,
    parentId?: string
  ): HTMLElement {
    // Handle error case
    if (!imageData.base64_data) {
      const span = createSpan(
        {
          'data-element-id': id,
          'data-type': 'image',
          'data-key': String(jsonNode.key ?? ''),
          'data-error': imageData.error || 'No image data',
          class: 'tp-code-image-error',
        },
        '[image error]'
      );
      this.addElement(id, 'image', jsonNode, span, parentId);
      return span;
    }

    // Create image element
    const format = imageData.format || 'png';
    const src = `data:image/${format.toLowerCase()};base64,${imageData.base64_data}`;

    const img = createImage(
      {
        'data-element-id': id,
        'data-type': 'image',
        'data-key': String(jsonNode.key ?? ''),
        class: 'tp-code-image',
        alt: `Image: ${imageData.width}x${imageData.height}`,
        title: `${imageData.width}x${imageData.height} ${imageData.format}`,
        style: 'max-width: 200px; max-height: 200px; display: block; margin: 4px 0;',
      },
      src
    );

    this.addElement(id, 'image', jsonNode, img, parentId);
    return img;
  }

  /**
   * Create a container span for nested content (nested prompt or list)
   */
  createContainer(
    id: string,
    type: string,
    jsonNode: ElementData,
    parentId?: string
  ): HTMLSpanElement {
    const span = createSpan({
      'data-element-id': id,
      'data-type': type,
      'data-key': String(jsonNode.key ?? ''),
    });

    this.addElement(id, type, jsonNode, span, parentId);
    return span;
  }

  /**
   * Push a new parent context (for nesting)
   */
  pushParent(element: HTMLElement): void {
    this.currentParent = element;
  }

  /**
   * Pop back to previous parent context
   */
  popParent(): void {
    if (this.currentParent.parentElement) {
      this.currentParent = this.currentParent.parentElement;
    }
  }

  /**
   * Get the root container element
   */
  getContainer(): HTMLDivElement {
    return this.container;
  }

  /**
   * Get the element map (for mapping/lookup)
   */
  getElementMap(): Map<string, ElementMetadata> {
    return this.elementMap;
  }

  /**
   * Get metadata for a specific element ID
   */
  getElementMetadata(id: string): ElementMetadata | undefined {
    return this.elementMap.get(id);
  }

  /**
   * Get all element IDs
   */
  getAllElementIds(): string[] {
    return Array.from(this.elementMap.keys());
  }
}
