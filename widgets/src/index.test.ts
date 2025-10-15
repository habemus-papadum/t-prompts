import { describe, it, expect } from 'vitest';
import { initWidget, VERSION } from './index';

describe('initWidget', () => {
  it('should initialize widget without crashing', () => {
    const container = document.createElement('div');
    container.setAttribute('data-tp-widget', 'true');

    // Add minimal widget data with proper structure
    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('data-role', 'tp-widget-data');
    scriptTag.textContent = JSON.stringify({
      ir: {
        chunks: [
          {
            type: 'TextChunk',
            text: 'Test',
            element_id: 'elem-1',
            id: 'chunk-1',
            metadata: {},
          },
        ],
        source_prompt_id: 'prompt-1',
        id: 'ir-1',
        metadata: {},
      },
      source_prompt: {
        prompt_id: 'prompt-1',
        children: [
          {
            type: 'static',
            id: 'elem-1',
            parent_id: 'prompt-1',
            key: 0,
            index: 0,
            source_location: null,
            value: 'Test',
          },
        ],
      },
    });
    container.appendChild(scriptTag);

    // Add mount point
    const mountPoint = document.createElement('div');
    mountPoint.className = 'tp-widget-mount';
    container.appendChild(mountPoint);

    initWidget(container);
    // Check for the output container that actually gets created
    expect(container.querySelector('.tp-widget-output')).toBeTruthy();
  });

  it('should include version', () => {
    expect(VERSION).toBe('0.9.0-alpha');
  });
});
