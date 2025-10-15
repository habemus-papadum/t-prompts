/**
 * Unit tests for StringWithMapping class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StringWithMapping } from './string-mapper';

describe('StringWithMapping', () => {
  let mapper: StringWithMapping;

  beforeEach(() => {
    mapper = new StringWithMapping();
  });

  describe('append and getText', () => {
    it('appends text and tracks it', () => {
      mapper.append('elem-1', 'Hello');

      expect(mapper.getText()).toBe('Hello');
    });

    it('appends multiple texts', () => {
      mapper.append('elem-1', 'Hello');
      mapper.append('elem-2', ' ');
      mapper.append('elem-3', 'World');

      expect(mapper.getText()).toBe('Hello World');
    });

    it('handles empty strings', () => {
      mapper.append('elem-1', 'Hello');
      mapper.append('elem-2', '');
      mapper.append('elem-3', 'World');

      expect(mapper.getText()).toBe('HelloWorld');
    });

    it('starts with empty string', () => {
      expect(mapper.getText()).toBe('');
    });
  });

  describe('getRange', () => {
    it('returns correct range for single element', () => {
      mapper.append('elem-1', 'Hello');

      const range = mapper.getRange('elem-1');
      expect(range).toEqual({ start: 0, end: 5 });
    });

    it('returns correct ranges for multiple elements', () => {
      mapper.append('elem-1', 'Hello');
      mapper.append('elem-2', ' ');
      mapper.append('elem-3', 'World');

      expect(mapper.getRange('elem-1')).toEqual({ start: 0, end: 5 });
      expect(mapper.getRange('elem-2')).toEqual({ start: 5, end: 6 });
      expect(mapper.getRange('elem-3')).toEqual({ start: 6, end: 11 });
    });

    it('returns null for non-existent element', () => {
      mapper.append('elem-1', 'Hello');

      expect(mapper.getRange('elem-999')).toBeNull();
    });

    it('handles empty string elements', () => {
      mapper.append('elem-1', 'Hello');
      mapper.append('elem-2', '');
      mapper.append('elem-3', 'World');

      expect(mapper.getRange('elem-2')).toEqual({ start: 5, end: 5 });
    });
  });

  describe('getElementAtPosition', () => {
    beforeEach(() => {
      mapper.append('elem-1', 'Hello');
      mapper.append('elem-2', ' ');
      mapper.append('elem-3', 'World');
    });

    it('finds element at start position', () => {
      expect(mapper.getElementAtPosition(0)).toBe('elem-1');
    });

    it('finds element in middle', () => {
      expect(mapper.getElementAtPosition(2)).toBe('elem-1');
      expect(mapper.getElementAtPosition(7)).toBe('elem-3');
    });

    it('finds element at boundary', () => {
      expect(mapper.getElementAtPosition(5)).toBe('elem-2');
      expect(mapper.getElementAtPosition(6)).toBe('elem-3');
    });

    it('returns null for position past end', () => {
      expect(mapper.getElementAtPosition(11)).toBeNull();
      expect(mapper.getElementAtPosition(100)).toBeNull();
    });

    it('returns null for negative position', () => {
      expect(mapper.getElementAtPosition(-1)).toBeNull();
    });

    it('handles position at end boundary correctly', () => {
      // Position 4 is the last character of 'Hello' (index 4)
      expect(mapper.getElementAtPosition(4)).toBe('elem-1');
      // Position 5 is the space
      expect(mapper.getElementAtPosition(5)).toBe('elem-2');
    });
  });

  describe('getElementsInRange', () => {
    beforeEach(() => {
      mapper.append('elem-1', 'Hello');
      mapper.append('elem-2', ' ');
      mapper.append('elem-3', 'World');
    });

    it('finds single element in range', () => {
      const elements = mapper.getElementsInRange(0, 3);
      expect(elements).toEqual(['elem-1']);
    });

    it('finds multiple elements in range', () => {
      const elements = mapper.getElementsInRange(0, 7);
      expect(elements).toEqual(['elem-1', 'elem-2', 'elem-3']);
    });

    it('finds elements with partial overlap', () => {
      const elements = mapper.getElementsInRange(4, 7);
      expect(elements).toEqual(['elem-1', 'elem-2', 'elem-3']);
    });

    it('finds elements at exact boundaries', () => {
      const elements = mapper.getElementsInRange(0, 5);
      expect(elements).toEqual(['elem-1']);
    });

    it('returns empty array for non-overlapping range', () => {
      const elements = mapper.getElementsInRange(20, 30);
      expect(elements).toEqual([]);
    });

    it('handles zero-length range', () => {
      const elements = mapper.getElementsInRange(5, 5);
      expect(elements).toEqual([]);
    });

    it('finds element that contains the entire range', () => {
      const elements = mapper.getElementsInRange(1, 3);
      expect(elements).toEqual(['elem-1']);
    });
  });

  describe('getLength', () => {
    it('returns 0 for empty string', () => {
      expect(mapper.getLength()).toBe(0);
    });

    it('returns correct length after appending', () => {
      mapper.append('elem-1', 'Hello');
      expect(mapper.getLength()).toBe(5);

      mapper.append('elem-2', ' World');
      expect(mapper.getLength()).toBe(11);
    });
  });

  describe('complex scenarios', () => {
    it('handles multiline text correctly', () => {
      mapper.append('elem-1', 'Line 1\n');
      mapper.append('elem-2', 'Line 2\n');
      mapper.append('elem-3', 'Line 3');

      expect(mapper.getText()).toBe('Line 1\nLine 2\nLine 3');
      expect(mapper.getRange('elem-1')).toEqual({ start: 0, end: 7 });
      expect(mapper.getRange('elem-2')).toEqual({ start: 7, end: 14 });
      expect(mapper.getRange('elem-3')).toEqual({ start: 14, end: 20 });
    });

    it('handles markdown-style text', () => {
      mapper.append('elem-1', '# ');
      mapper.append('elem-2', 'Header');
      mapper.append('elem-3', '\n');
      mapper.append('elem-4', 'Paragraph text');

      expect(mapper.getText()).toBe('# Header\nParagraph text');
      expect(mapper.getElementAtPosition(0)).toBe('elem-1');
      expect(mapper.getElementAtPosition(2)).toBe('elem-2');
      expect(mapper.getElementAtPosition(8)).toBe('elem-3');
      expect(mapper.getElementAtPosition(9)).toBe('elem-4');
    });

    it('tracks many small elements', () => {
      for (let i = 0; i < 100; i++) {
        mapper.append(`elem-${i}`, `${i}`);
      }

      // Should handle lookup efficiently
      expect(mapper.getElementAtPosition(0)).toBe('elem-0');
      expect(mapper.getElementAtPosition(50)).not.toBeNull();
    });

    it('handles special characters', () => {
      mapper.append('elem-1', '<thinking>\n');
      mapper.append('elem-2', 'Content with "quotes" & symbols');
      mapper.append('elem-3', '\n</thinking>');

      const text = mapper.getText();
      expect(text).toContain('<thinking>');
      expect(text).toContain('&');
      expect(text).toContain('</thinking>');

      // Should find elements correctly
      expect(mapper.getElementAtPosition(0)).toBe('elem-1');
      expect(mapper.getElementAtPosition(15)).toBe('elem-2');
    });
  });

  describe('debugPositions', () => {
    it('generates debug output', () => {
      mapper.append('elem-1', 'Hello');
      mapper.append('elem-2', ' ');
      mapper.append('elem-3', 'World');

      const debug = mapper.debugPositions();

      expect(debug).toContain('String positions:');
      expect(debug).toContain('elem-1');
      expect(debug).toContain('[0, 5]');
      expect(debug).toContain('Hello');
    });

    it('truncates long content in debug output', () => {
      const longText = 'a'.repeat(50);
      mapper.append('elem-1', longText);

      const debug = mapper.debugPositions();

      expect(debug).toContain('...');
      expect(debug.length).toBeLessThan(longText.length + 100);
    });

    it('escapes newlines in debug output', () => {
      mapper.append('elem-1', 'Line 1\nLine 2');

      const debug = mapper.debugPositions();

      expect(debug).toContain('\\n');
    });
  });
});
