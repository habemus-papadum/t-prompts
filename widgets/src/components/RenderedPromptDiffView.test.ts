import { beforeEach, describe, expect, it } from 'vitest';

import { buildRenderedPromptDiffView } from './RenderedPromptDiffView';
import type { RenderedPromptDiffData } from '../diff-types';

describe('RenderedPromptDiffView', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('skips equal chunks and decorates operations with diff styling', () => {
    const data: RenderedPromptDiffData = {
      diff_type: 'rendered',
      stats: { insert: 1, delete: 1, replace: 1, equal: 1 },
      metrics: {
        token_delta: 8,
        non_ws_delta: 6,
        ws_delta: 2,
        chunk_drift: 0.5,
      },
      chunk_deltas: [
        {
          op: 'equal',
          before: { text: 'Header', element_id: 'a-before' },
          after: { text: 'Header', element_id: 'a-after' },
        },
        {
          op: 'insert',
          before: null,
          after: { text: 'New line', element_id: 'b-after' },
        },
        {
          op: 'delete',
          before: { text: 'Removed line', element_id: 'c-before' },
          after: null,
        },
        {
          op: 'replace',
          before: { text: 'Old body', element_id: 'd-before' },
          after: { text: 'Updated body', element_id: 'd-after' },
        },
      ],
    };

    const component = buildRenderedPromptDiffView(data);
    document.body.appendChild(component.element);

    const chunks = component.element.querySelectorAll('.tp-diff-chunk');
    expect(chunks).toHaveLength(3);

    const pills = component.element.querySelectorAll('.tp-diff-pill');
    expect(pills).toHaveLength(8);
    expect(pills[pills.length - 1]?.textContent).toBe('Chunk drift: 0.50');

    const insertText = component.element.querySelector(
      '.tp-diff-chunk[data-op="insert"] .tp-diff-chunk-text'
    );
    expect(insertText?.textContent).toBe('+ New line');
    expect(insertText?.classList.contains('tp-diff-ins')).toBe(true);

    const deleteText = component.element.querySelector(
      '.tp-diff-chunk[data-op="delete"] .tp-diff-chunk-text'
    );
    expect(deleteText?.textContent).toBe('- Removed line');
    expect(deleteText?.classList.contains('tp-diff-del')).toBe(true);

    const replaceText = component.element.querySelector(
      '.tp-diff-chunk[data-op="replace"] .tp-diff-chunk-text'
    );
    const replaceParts = replaceText?.querySelectorAll('span');
    expect(replaceParts).toHaveLength(2);
    expect(replaceParts?.[0]?.classList.contains('tp-diff-del')).toBe(true);
    expect(replaceParts?.[0]?.textContent).toBe('- Old body');
    expect(replaceParts?.[1]?.classList.contains('tp-diff-ins')).toBe(true);
    expect(replaceParts?.[1]?.textContent).toBe('+ Updated body');
  });
});
