import { describe, it, expect } from 'vitest';
import { renderPrompt, VERSION } from './index';

describe('renderPrompt', () => {
  it('should render without crashing', () => {
    const container = document.createElement('div');
    renderPrompt(container, { test: 'data' });
    expect(container.children.length).toBe(1);
  });

  it('should include version', () => {
    expect(VERSION).toBe('0.9.0-alpha');
  });
});
