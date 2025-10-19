/**
 * RenderedPromptDiffView Component
 *
 * Displays a chunk-level diff of rendered prompt outputs.
 * Non-interactive for now - just displays the diff.
 */

import type { Component } from './base';
import type { RenderedPromptDiffData, ChunkDelta } from '../diff-types';

/**
 * RenderedPromptDiffView component interface
 * Currently just the base Component interface
 */
export type RenderedPromptDiffView = Component;

/**
 * Build a RenderedPromptDiffView component from diff data
 */
export function buildRenderedPromptDiffView(
  data: RenderedPromptDiffData
): RenderedPromptDiffView {
  // 1. Create root element
  const element = document.createElement('div');
  element.className = 'tp-diff-view';
  element.setAttribute('data-role', 'tp-diff-rendered');

  // 2. Build header
  const header = document.createElement('div');
  header.className = 'tp-diff-header';
  header.textContent = 'Rendered diff';
  element.appendChild(header);

  // 3. Build summary with stats
  const summary = document.createElement('div');
  summary.className = 'tp-diff-summary';

  const statsItems = [
    { label: 'Insert', value: data.stats.insert },
    { label: 'Delete', value: data.stats.delete },
    { label: 'Replace', value: data.stats.replace },
    { label: 'Equal', value: data.stats.equal },
  ];

  for (const { label, value } of statsItems) {
    const pill = document.createElement('span');
    pill.className = 'tp-diff-pill';
    pill.textContent = `${label}: ${value}`;
    summary.appendChild(pill);
  }

  element.appendChild(summary);

  // 4. Build body with legend and chunks
  const body = document.createElement('div');
  body.className = 'tp-diff-body';

  // Legend
  const legend = document.createElement('div');
  legend.className = 'tp-diff-legend';

  const legendItems = [
    { label: 'Insert', class: 'insert' },
    { label: 'Delete', class: 'delete' },
    { label: 'Replace', class: 'modify' },
  ];

  for (const { label, class: dotClass } of legendItems) {
    const span = document.createElement('span');

    const dot = document.createElement('span');
    dot.className = `tp-diff-dot ${dotClass}`;
    span.appendChild(dot);

    span.appendChild(document.createTextNode(label));
    legend.appendChild(span);
  }

  body.appendChild(legend);

  // Chunk list (skip "equal" chunks)
  const chunkList = document.createElement('ul');
  chunkList.className = 'tp-diff-chunks';

  for (const delta of data.chunk_deltas) {
    if (delta.op === 'equal') {
      continue;
    }
    chunkList.appendChild(renderChunkDelta(delta));
  }

  body.appendChild(chunkList);
  element.appendChild(body);

  // 5. Return component
  return {
    element,
    destroy: (): void => {
      // No cleanup needed for now
    },
  };
}

/**
 * Render a single ChunkDelta as HTML
 */
function renderChunkDelta(delta: ChunkDelta): HTMLElement {
  const li = document.createElement('li');
  li.className = 'tp-diff-chunk';
  li.setAttribute('data-op', delta.op);

  const textDiv = document.createElement('div');
  textDiv.className = 'tp-diff-chunk-text';

  if (delta.op === 'equal') {
    const text = delta.after?.text ?? delta.before?.text ?? '';
    textDiv.textContent = text;
  } else if (delta.op === 'insert') {
    textDiv.classList.add('tp-diff-ins');
    textDiv.textContent = `+ ${delta.after?.text || ''}`;
  } else if (delta.op === 'delete') {
    textDiv.classList.add('tp-diff-del');
    textDiv.textContent = `- ${delta.before?.text || ''}`;
  } else if (delta.op === 'replace') {
    const beforeText = delta.before?.text || '';
    const afterText = delta.after?.text || '';

    const deleteSpan = document.createElement('span');
    deleteSpan.className = 'tp-diff-del';
    deleteSpan.textContent = `- ${beforeText}`;

    const insertSpan = document.createElement('span');
    insertSpan.className = 'tp-diff-ins';
    insertSpan.textContent = `+ ${afterText}`;

    textDiv.textContent = '';
    textDiv.appendChild(deleteSpan);
    textDiv.appendChild(document.createTextNode('\n'));
    textDiv.appendChild(insertSpan);
  }

  li.appendChild(textDiv);

  return li;
}
