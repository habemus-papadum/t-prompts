import { describe, it, expect, beforeEach } from 'vitest';
import { applyTransform_BeforeDiffOverlay } from './beforeDiffOverlay';
import type { TransformState } from './base';
import type { WidgetData, WidgetMetadata } from '../types';

function buildMetadata(): WidgetMetadata {
  return {
    elementTypeMap: {},
    elementLocationMap: {},
    elementLocationDetails: {},
    chunkSizeMap: {},
    chunkLocationMap: {},
  };
}

describe('applyTransform_BeforeDiffOverlay', () => {
  let metadata: WidgetMetadata;

  beforeEach(() => {
    metadata = buildMetadata();
  });

  it('marks only the replaced before chunks', () => {
    const container = document.createElement('div');
    const chunks = new Map<string, HTMLElement[]>();

    const equalEl = document.createElement('span');
    equalEl.setAttribute('data-chunk-id', 'chunk-equal');
    chunks.set('chunk-equal', [equalEl]);

    const replaceEl = document.createElement('span');
    replaceEl.setAttribute('data-chunk-id', 'chunk-replace');
    chunks.set('chunk-replace', [replaceEl]);

    const data: WidgetData = {
      diff_context: {
        before_prompt: {
          id: 'before',
          source_prompt_id: null,
          metadata: {},
          chunks: [
            { id: 'chunk-equal', type: 'TextChunk', text: 'team@example.com', element_id: 'node-email', metadata: {} },
            { id: 'chunk-replace', type: 'TextChunk', text: 'Project Update', element_id: 'node-subject', metadata: {} },
          ],
        },
        structured: {} as any,
        rendered: {
          diff_type: 'rendered',
          chunk_deltas: [
            {
              op: 'replace',
              before: { text: 'Project Update', element_id: 'node-subject' },
              after: { text: 'Project Update - Week 3', element_id: 'node-subject-next' },
            },
          ],
          stats: {} as any,
          metrics: {} as any,
        },
      },
    };

    const state: TransformState = {
      element: container,
      chunks,
      data,
      metadata,
    };

    applyTransform_BeforeDiffOverlay(state);

    expect(equalEl.getAttribute('data-diff-op')).toBeNull();
    expect(replaceEl.getAttribute('data-diff-op')).toBe('replace');
    expect(replaceEl.classList.contains('tp-diff-replace-before')).toBe(true);
  });

  it('ignores equal chunks even when text repeats in other ops', () => {
    const container = document.createElement('div');
    const chunks = new Map<string, HTMLElement[]>();

    const equalEl = document.createElement('span');
    equalEl.setAttribute('data-chunk-id', 'chunk-equal');
    chunks.set('chunk-equal', [equalEl]);

    const deleteEl = document.createElement('span');
    deleteEl.setAttribute('data-chunk-id', 'chunk-delete');
    chunks.set('chunk-delete', [deleteEl]);

    const data: WidgetData = {
      diff_context: {
        before_prompt: {
          id: 'before',
          source_prompt_id: null,
          metadata: {},
          chunks: [
            { id: 'chunk-equal', type: 'TextChunk', text: 'shared text', element_id: 'node-shared', metadata: {} },
            { id: 'chunk-delete', type: 'TextChunk', text: 'shared text', element_id: 'node-delete', metadata: {} },
          ],
        },
        structured: {} as any,
        rendered: {
          diff_type: 'rendered',
          chunk_deltas: [
            {
              op: 'delete',
              before: { text: 'shared text', element_id: 'node-delete' },
              after: null,
            },
          ],
          stats: {} as any,
          metrics: {} as any,
        },
      },
    };

    const state: TransformState = {
      element: container,
      chunks,
      data,
      metadata,
    };

    applyTransform_BeforeDiffOverlay(state);

    expect(equalEl.getAttribute('data-diff-op')).toBeNull();
    expect(deleteEl.getAttribute('data-diff-op')).toBe('delete');
    expect(deleteEl.classList.contains('tp-diff-delete')).toBe(true);
  });
});
