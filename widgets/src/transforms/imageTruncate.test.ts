import { describe, it, expect } from 'vitest';
import { applyTransform_ImageTruncate } from './imageTruncate';
import type { TransformState } from './base';
import type { ImageData } from '../types';

describe('applyTransform_ImageTruncate', () => {
  function createState(chunks: Map<string, HTMLElement[]>): TransformState {
    return {
      element: document.createElement('div'),
      chunks,
      data: {},
      metadata: {
        elementTypeMap: {},
        elementLocationMap: {},
        chunkSizeMap: {},
      },
    } as TransformState;
  }

  function createImageElement(chunkId: string, imageData: ImageData): HTMLElement {
    const span = document.createElement('span');
    span.setAttribute('data-chunk-id', chunkId);
    span.textContent = `![${imageData.format} ${imageData.width}x${imageData.height}](data:image/${imageData.format.toLowerCase()};base64,${imageData.base64_data})`;
    span.setAttribute('title', 'example');
    (span as HTMLElement & { _imageData?: ImageData })._imageData = imageData;
    return span;
  }

  it('truncates text for each tracked image element in the chunk map', () => {
    const chunkId = 'chunk-1';
    const imageData: ImageData = {
      base64_data: 'abc123',
      format: 'PNG',
      width: 50,
      height: 50,
    };

    const first = createImageElement(chunkId, imageData);
    const second = createImageElement(chunkId, imageData);

    const chunks = new Map<string, HTMLElement[]>([[chunkId, [first, second]]]);
    const state = createState(chunks);

    applyTransform_ImageTruncate(state);

    const expected = '![PNG 50x50](...)';
    expect(first.textContent).toBe(expected);
    expect(second.textContent).toBe(expected);
    expect(first.hasAttribute('title')).toBe(false);
    expect(second.hasAttribute('title')).toBe(false);
  });

  it('leaves non-image chunks untouched', () => {
    const chunkId = 'chunk-text';
    const span = document.createElement('span');
    span.setAttribute('data-chunk-id', chunkId);
    span.textContent = 'plain text chunk';

    const chunks = new Map<string, HTMLElement[]>([[chunkId, [span]]]);
    const state = createState(chunks);

    applyTransform_ImageTruncate(state);

    expect(span.textContent).toBe('plain text chunk');
  });
});
