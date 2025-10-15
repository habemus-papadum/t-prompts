/**
 * Unit tests for DOM builder helper functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSpan, createDiv, createImage, createText, escapeHtml } from './dom-builder';

describe('DOM Builder', () => {
  describe('createSpan', () => {
    it('creates span with attributes', () => {
      const span = createSpan({ 'data-id': 'test', 'class': 'test-class' });

      expect(span.tagName).toBe('SPAN');
      expect(span.getAttribute('data-id')).toBe('test');
      expect(span.getAttribute('class')).toBe('test-class');
    });

    it('creates span with string child', () => {
      const span = createSpan({ 'data-id': 'test' }, 'Hello World');

      expect(span.textContent).toBe('Hello World');
    });

    it('creates span with multiple string children', () => {
      const span = createSpan({ 'data-id': 'test' }, 'Hello', ' ', 'World');

      expect(span.textContent).toBe('Hello World');
    });

    it('creates span with element children', () => {
      const child = document.createElement('strong');
      child.textContent = 'Bold';
      const span = createSpan({ 'data-id': 'test' }, 'Text ', child);

      expect(span.childNodes.length).toBe(2);
      expect(span.childNodes[0].textContent).toBe('Text ');
      expect(span.childNodes[1].textContent).toBe('Bold');
      expect(span.childNodes[1].nodeName).toBe('STRONG');
    });

    it('creates span with mixed children types', () => {
      const textNode = createText('plain text');
      const strongElement = document.createElement('strong');
      strongElement.textContent = 'bold';

      const span = createSpan(
        { 'data-id': 'test' },
        'Start ',
        textNode,
        ' ',
        strongElement,
        ' End'
      );

      expect(span.textContent).toBe('Start plain text bold End');
    });

    it('handles empty children', () => {
      const span = createSpan({ 'data-id': 'test' });

      expect(span.childNodes.length).toBe(0);
      expect(span.textContent).toBe('');
    });
  });

  describe('createDiv', () => {
    it('creates div with attributes', () => {
      const div = createDiv({ 'class': 'container', 'id': 'main' });

      expect(div.tagName).toBe('DIV');
      expect(div.getAttribute('class')).toBe('container');
      expect(div.getAttribute('id')).toBe('main');
    });

    it('creates div with children', () => {
      const div = createDiv({ 'class': 'container' }, 'Content');

      expect(div.textContent).toBe('Content');
    });

    it('creates div with element children', () => {
      const child1 = createSpan({ 'data-id': '1' }, 'First');
      const child2 = createSpan({ 'data-id': '2' }, 'Second');

      const div = createDiv({ 'class': 'container' }, child1, ' ', child2);

      expect(div.childNodes.length).toBe(3);
      expect(div.textContent).toBe('First Second');
    });
  });

  describe('createImage', () => {
    it('creates image with src and attributes', () => {
      const img = createImage({ 'alt': 'Test Image', 'class': 'photo' }, 'test.jpg');

      expect(img.tagName).toBe('IMG');
      expect(img.src).toContain('test.jpg');
      expect(img.getAttribute('alt')).toBe('Test Image');
      expect(img.getAttribute('class')).toBe('photo');
    });

    it('creates image with data URI', () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
      const img = createImage({ 'alt': 'Data' }, dataUri);

      expect(img.src).toBe(dataUri);
    });
  });

  describe('createText', () => {
    it('creates text node', () => {
      const text = createText('Hello World');

      expect(text.nodeType).toBe(Node.TEXT_NODE);
      expect(text.textContent).toBe('Hello World');
    });

    it('handles empty string', () => {
      const text = createText('');

      expect(text.nodeType).toBe(Node.TEXT_NODE);
      expect(text.textContent).toBe('');
    });
  });

  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      const escaped = escapeHtml('<script>alert("XSS")</script>');

      expect(escaped).toBe('&lt;script&gt;alert("XSS")&lt;/script&gt;');
    });

    it('escapes ampersands', () => {
      const escaped = escapeHtml('Tom & Jerry');

      expect(escaped).toBe('Tom &amp; Jerry');
    });

    it('escapes quotes', () => {
      const escaped = escapeHtml('Say "Hello"');

      expect(escaped).toBe('Say "Hello"');
    });

    it('handles plain text without escaping', () => {
      const escaped = escapeHtml('Plain text 123');

      expect(escaped).toBe('Plain text 123');
    });

    it('handles empty string', () => {
      const escaped = escapeHtml('');

      expect(escaped).toBe('');
    });

    it('handles newlines and special characters', () => {
      const escaped = escapeHtml('Line 1\nLine 2\t<tag>');

      expect(escaped).toContain('Line 1');
      expect(escaped).toContain('Line 2');
      expect(escaped).toContain('&lt;tag&gt;');
    });
  });
});
