import { describe, it, expect } from 'vitest';
import { initWidget, VERSION } from './index';

describe('initWidget', () => {
  it('should initialize widget without crashing', () => {
    const container = document.createElement('div');
    container.setAttribute('data-tp-widget', 'true');

    // Add minimal widget data
    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('data-role', 'tp-widget-data');
    scriptTag.textContent = JSON.stringify({
      prompt_id: 'test-123',
      children: []
    });
    container.appendChild(scriptTag);

    // Add mount point
    const mountPoint = document.createElement('div');
    mountPoint.className = 'tp-widget-mount';
    container.appendChild(mountPoint);

    initWidget(container);
    expect(container.querySelector('.tp-widget-container')).toBeTruthy();
  });

  it('should include version', () => {
    expect(VERSION).toBe('0.9.0-alpha');
  });
});
