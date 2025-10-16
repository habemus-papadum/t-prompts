/**
 * Tests for line wrapping transform
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { applyTransform_LineWrap } from './lineWrap';
import type { TransformState } from './base';
import type { WidgetData, WidgetMetadata } from '../types';

describe('lineWrap transform', () => {
  let container: HTMLDivElement;
  let chunks: Map<string, HTMLElement[]>;
  let mockData: WidgetData;
  let mockMetadata: WidgetMetadata;

  beforeEach(() => {
    // Create a fresh DOM container for each test
    container = document.createElement('div');
    chunks = new Map();

    // Mock data (minimal)
    mockData = {
      ir: { chunks: [] },
      compiled_ir: { subtree_map: {} },
    } as WidgetData;

    mockMetadata = {
      elementTypeMap: {},
      elementLocationMap: {},
    };
  });

  it('should not wrap text shorter than column limit', () => {
    // Create a simple span with short text
    const span = document.createElement('span');
    span.setAttribute('data-chunk-id', 'chunk1');
    span.className = 'tp-chunk-static';
    span.textContent = 'Short text';
    container.appendChild(span);
    chunks.set('chunk1', [span]);

    const state: TransformState = {
      element: container,
      chunks,
      data: mockData,
      metadata: mockMetadata,
    };

    applyTransform_LineWrap(state, 100);

    // Should not have been wrapped
    expect(container.children.length).toBe(1);
    expect(container.querySelector('.tp-wrap-container')).toBeNull();
    expect(container.querySelector('.tp-wrap-continuation')).toBeNull();
  });

  it('should wrap text longer than column limit', () => {
    // Create a span with text longer than 100 chars
    const longText = 'a'.repeat(150);
    const span = document.createElement('span');
    span.setAttribute('data-chunk-id', 'chunk1');
    span.className = 'tp-chunk-static';
    span.textContent = longText;
    container.appendChild(span);
    chunks.set('chunk1', [span]);

    const state: TransformState = {
      element: container,
      chunks,
      data: mockData,
      metadata: mockMetadata,
    };

    applyTransform_LineWrap(state, 100);

    // Should have created a wrap container
    const wrapContainer = container.querySelector('.tp-wrap-container');
    expect(wrapContainer).not.toBeNull();
    expect(wrapContainer?.classList.contains('tp-chunk-static')).toBe(true);

    // Should have a line break
    const lineBreak = wrapContainer?.querySelector('br.tp-wrap-newline');
    expect(lineBreak).not.toBeNull();

    // Should have a continuation span
    const continuation = wrapContainer?.querySelector('.tp-wrap-continuation');
    expect(continuation).not.toBeNull();
    expect(continuation?.classList.contains('tp-chunk-static')).toBe(true);

    // Check text splitting
    const firstPart = wrapContainer?.children[0] as HTMLElement;
    const continuationPart = wrapContainer?.children[2] as HTMLElement;
    expect(firstPart?.textContent).toBe('a'.repeat(100));
    expect(continuationPart?.textContent).toBe('a'.repeat(50));
  });

  it('should preserve data-chunk-id on all elements', () => {
    const longText = 'a'.repeat(150);
    const span = document.createElement('span');
    span.setAttribute('data-chunk-id', 'chunk1');
    span.className = 'tp-chunk-static';
    span.textContent = longText;
    container.appendChild(span);
    chunks.set('chunk1', [span]);

    const state: TransformState = {
      element: container,
      chunks,
      data: mockData,
      metadata: mockMetadata,
    };

    applyTransform_LineWrap(state, 100);

    const wrapContainer = container.querySelector('.tp-wrap-container');
    expect(wrapContainer?.getAttribute('data-chunk-id')).toBe('chunk1');

    const allSpans = wrapContainer?.querySelectorAll('span');
    allSpans?.forEach((span) => {
      expect(span.getAttribute('data-chunk-id')).toBe('chunk1');
    });
  });

  it('should handle multi-wrap scenario (right-leaning tree)', () => {
    // Text that needs 3 lines (250 chars)
    const longText = 'a'.repeat(250);
    const span = document.createElement('span');
    span.setAttribute('data-chunk-id', 'chunk1');
    span.className = 'tp-chunk-static';
    span.textContent = longText;
    container.appendChild(span);
    chunks.set('chunk1', [span]);

    const state: TransformState = {
      element: container,
      chunks,
      data: mockData,
      metadata: mockMetadata,
    };

    applyTransform_LineWrap(state, 100);

    // Top-level container
    const topContainer = container.querySelector('.tp-wrap-container');
    expect(topContainer).not.toBeNull();

    // Should have nested wrap container for the second wrap (inside the top container)
    const nestedContainers = topContainer?.querySelectorAll('.tp-wrap-container');
    expect(nestedContainers?.length).toBeGreaterThanOrEqual(1);

    // Should have 2 line breaks total
    const lineBreaks = topContainer?.querySelectorAll('br.tp-wrap-newline');
    expect(lineBreaks?.length).toBe(2);

    // Should have 2 continuation markers
    const continuations = topContainer?.querySelectorAll('.tp-wrap-continuation');
    expect(continuations?.length).toBe(2);
  });

  it('should update chunks map with wrapped container', () => {
    const longText = 'a'.repeat(150);
    const span = document.createElement('span');
    span.setAttribute('data-chunk-id', 'chunk1');
    span.className = 'tp-chunk-static';
    span.textContent = longText;
    container.appendChild(span);
    chunks.set('chunk1', [span]);

    const state: TransformState = {
      element: container,
      chunks,
      data: mockData,
      metadata: mockMetadata,
    };

    applyTransform_LineWrap(state, 100);

    // Chunks map should now point to the wrap container, not the original span
    const trackedElements = chunks.get('chunk1');
    expect(trackedElements?.length).toBe(1);
    expect(trackedElements?.[0].classList.contains('tp-wrap-container')).toBe(true);
  });

  it('should handle column tracking across multiple elements', () => {
    // First element: 60 chars
    const span1 = document.createElement('span');
    span1.setAttribute('data-chunk-id', 'chunk1');
    span1.className = 'tp-chunk-static';
    span1.textContent = 'a'.repeat(60);
    container.appendChild(span1);
    chunks.set('chunk1', [span1]);

    // Second element: 60 chars (should wrap at position 40)
    const span2 = document.createElement('span');
    span2.setAttribute('data-chunk-id', 'chunk2');
    span2.className = 'tp-chunk-interpolation';
    span2.textContent = 'b'.repeat(60);
    container.appendChild(span2);
    chunks.set('chunk2', [span2]);

    const state: TransformState = {
      element: container,
      chunks,
      data: mockData,
      metadata: mockMetadata,
    };

    applyTransform_LineWrap(state, 100);

    // First span should not be wrapped
    const firstChild = container.children[0];
    expect(firstChild.classList.contains('tp-wrap-container')).toBe(false);
    expect(firstChild.textContent).toBe('a'.repeat(60));

    // Second span should be wrapped
    const secondChild = container.children[1];
    expect(secondChild.classList.contains('tp-wrap-container')).toBe(true);

    // Check that split happened at the right position (40 chars remaining in first line)
    const wrapContainer = secondChild as HTMLElement;
    const firstPart = wrapContainer.children[0] as HTMLElement;
    expect(firstPart.textContent).toBe('b'.repeat(40));
  });

  it('should only apply continuation class to direct children, not nested containers', () => {
    // Text that needs multiple wraps
    const longText = 'a'.repeat(250);
    const span = document.createElement('span');
    span.setAttribute('data-chunk-id', 'chunk1');
    span.className = 'tp-chunk-static';
    span.textContent = longText;
    container.appendChild(span);
    chunks.set('chunk1', [span]);

    const state: TransformState = {
      element: container,
      chunks,
      data: mockData,
      metadata: mockMetadata,
    };

    applyTransform_LineWrap(state, 100);

    // Get all elements with continuation class
    const continuations = container.querySelectorAll('.tp-wrap-continuation');

    // Each continuation should be either:
    // 1. A leaf span with text content
    // 2. OR a wrap-container (for nested wraps)
    continuations.forEach((elem) => {
      const isLeafSpan = !elem.classList.contains('tp-wrap-container');
      const isNestedContainer = elem.classList.contains('tp-wrap-container');
      expect(isLeafSpan || isNestedContainer).toBe(true);
    });
  });

  it('should preserve CSS classes from original element', () => {
    const longText = 'a'.repeat(150);
    const span = document.createElement('span');
    span.setAttribute('data-chunk-id', 'chunk1');
    span.className = 'tp-chunk-static tp-first-static custom-class';
    span.textContent = longText;
    container.appendChild(span);
    chunks.set('chunk1', [span]);

    const state: TransformState = {
      element: container,
      chunks,
      data: mockData,
      metadata: mockMetadata,
    };

    applyTransform_LineWrap(state, 100);

    const wrapContainer = container.querySelector('.tp-wrap-container');
    expect(wrapContainer?.classList.contains('tp-chunk-static')).toBe(true);
    expect(wrapContainer?.classList.contains('tp-first-static')).toBe(true);
    expect(wrapContainer?.classList.contains('custom-class')).toBe(true);
  });
});
