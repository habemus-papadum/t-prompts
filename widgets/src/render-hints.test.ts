/**
 * Unit tests for render hints parsing and application
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseRenderHints,
  getNextHeaderLevel,
  capHeaderLevel,
} from './render-hints';

describe('Render Hints', () => {
  describe('parseRenderHints', () => {
    it('parses header hint with value', () => {
      const hints = parseRenderHints('header=Task Description', 'task');

      expect(hints.header).toBe('Task Description');
      expect(hints.xml).toBeUndefined();
      expect(hints.sep).toBeUndefined();
    });

    it('parses header hint without value (uses key)', () => {
      const hints = parseRenderHints('header', 'mykey');

      expect(hints.header).toBe('mykey');
    });

    it('parses xml hint', () => {
      const hints = parseRenderHints('xml=thinking', 'reasoning');

      expect(hints.xml).toBe('thinking');
      expect(hints.header).toBeUndefined();
    });

    it('parses separator hint', () => {
      const hints = parseRenderHints('sep=, ', 'items');

      expect(hints.sep).toBe(', ');
    });

    it('preserves separator whitespace', () => {
      const hints = parseRenderHints('sep=  ', 'items');

      expect(hints.sep).toBe('  ');
    });

    it('parses combined header and xml', () => {
      const hints = parseRenderHints('header=Analysis:xml=process', 'analysis');

      expect(hints.header).toBe('Analysis');
      expect(hints.xml).toBe('process');
    });

    it('parses all hints together', () => {
      const hints = parseRenderHints('header=Items:xml=list:sep=, ', 'items');

      expect(hints.header).toBe('Items');
      expect(hints.xml).toBe('list');
      expect(hints.sep).toBe(', ');
    });

    it('handles empty string', () => {
      const hints = parseRenderHints('', 'key');

      expect(hints).toEqual({});
    });

    it('trims whitespace around hints', () => {
      const hints = parseRenderHints(' header=Task : xml=thinking ', 'task');

      expect(hints.header).toBe('Task');
      expect(hints.xml).toBe('thinking');
    });

    it('throws error for XML tag with whitespace', () => {
      expect(() => {
        parseRenderHints('xml=my tag', 'task');
      }).toThrow('XML tag name cannot contain whitespace');
    });

    it('allows whitespace in header text', () => {
      const hints = parseRenderHints('header=My Task Description', 'task');

      expect(hints.header).toBe('My Task Description');
    });

    it('handles header without value using key', () => {
      const hints = parseRenderHints('header:xml=data', 'Instructions');

      expect(hints.header).toBe('Instructions');
      expect(hints.xml).toBe('data');
    });

    it('ignores unknown hints', () => {
      const hints = parseRenderHints('header=Task:unknown=value:xml=thinking', 'task');

      expect(hints.header).toBe('Task');
      expect(hints.xml).toBe('thinking');
      expect(hints).not.toHaveProperty('unknown');
    });

    it('handles multiple colons in order', () => {
      const hints = parseRenderHints('header=A:xml=b:sep=,:header=C', 'key');

      // Last header wins (though this is unlikely in practice)
      expect(hints.header).toBe('C');
      expect(hints.xml).toBe('b');
      expect(hints.sep).toBe(',');
    });

    it('preserves empty separator', () => {
      const hints = parseRenderHints('sep=', 'items');

      expect(hints.sep).toBe('');
    });
  });

  describe('getNextHeaderLevel', () => {
    it('increments level when header hint present', () => {
      expect(getNextHeaderLevel(1, true)).toBe(2);
      expect(getNextHeaderLevel(2, true)).toBe(3);
      expect(getNextHeaderLevel(3, true)).toBe(4);
    });

    it('keeps same level when no header hint', () => {
      expect(getNextHeaderLevel(1, false)).toBe(1);
      expect(getNextHeaderLevel(2, false)).toBe(2);
      expect(getNextHeaderLevel(3, false)).toBe(3);
    });

    it('continues incrementing beyond max (capping happens separately)', () => {
      expect(getNextHeaderLevel(4, true)).toBe(5);
      expect(getNextHeaderLevel(5, true)).toBe(6);
    });
  });

  describe('capHeaderLevel', () => {
    it('caps level at max (default 4)', () => {
      expect(capHeaderLevel(1)).toBe(1);
      expect(capHeaderLevel(2)).toBe(2);
      expect(capHeaderLevel(3)).toBe(3);
      expect(capHeaderLevel(4)).toBe(4);
      expect(capHeaderLevel(5)).toBe(4);
      expect(capHeaderLevel(6)).toBe(4);
    });

    it('caps at custom max level', () => {
      expect(capHeaderLevel(1, 2)).toBe(1);
      expect(capHeaderLevel(2, 2)).toBe(2);
      expect(capHeaderLevel(3, 2)).toBe(2);
      expect(capHeaderLevel(4, 2)).toBe(2);
    });

    it('handles level 1 max', () => {
      expect(capHeaderLevel(1, 1)).toBe(1);
      expect(capHeaderLevel(2, 1)).toBe(1);
    });

    it('handles high max level', () => {
      expect(capHeaderLevel(5, 10)).toBe(5);
      expect(capHeaderLevel(10, 10)).toBe(10);
      expect(capHeaderLevel(11, 10)).toBe(10);
    });
  });

  describe('integration scenarios', () => {
    it('handles realistic prompt structure hints', () => {
      // Main section with header
      const main = parseRenderHints('header=Main Section', 'main');
      expect(main.header).toBe('Main Section');

      // Nested thinking with XML
      const thinking = parseRenderHints('xml=thinking', 'reasoning');
      expect(thinking.xml).toBe('thinking');

      // List with custom separator
      const list = parseRenderHints('header=Examples:sep=\\n\\n', 'examples');
      expect(list.header).toBe('Examples');
      expect(list.sep).toBe('\\n\\n'); // Literal backslash-n, not newline
    });

    it('handles header nesting levels correctly', () => {
      let level = 1;

      // Level 1 header
      const hints1 = parseRenderHints('header=Level 1', 'l1');
      expect(hints1.header).toBe('Level 1');
      expect(capHeaderLevel(level, 4)).toBe(1);

      // Nested level 2
      level = getNextHeaderLevel(level, !!hints1.header);
      const hints2 = parseRenderHints('header=Level 2', 'l2');
      expect(hints2.header).toBe('Level 2');
      expect(capHeaderLevel(level, 4)).toBe(2);

      // Nested level 3
      level = getNextHeaderLevel(level, !!hints2.header);
      const hints3 = parseRenderHints('header=Level 3', 'l3');
      expect(hints3.header).toBe('Level 3');
      expect(capHeaderLevel(level, 4)).toBe(3);

      // Nested level 4 (capped)
      level = getNextHeaderLevel(level, !!hints3.header);
      const hints4 = parseRenderHints('header=Level 4', 'l4');
      expect(hints4.header).toBe('Level 4');
      expect(capHeaderLevel(level, 4)).toBe(4);

      // Nested level 5 (capped at 4)
      level = getNextHeaderLevel(level, !!hints4.header);
      const hints5 = parseRenderHints('header=Level 5', 'l5');
      expect(hints5.header).toBe('Level 5');
      expect(capHeaderLevel(level, 4)).toBe(4); // Still 4
    });

    it('handles combined header and XML for structured content', () => {
      const hints = parseRenderHints('header=Analysis:xml=thinking', 'analysis');

      expect(hints.header).toBe('Analysis');
      expect(hints.xml).toBe('thinking');

      // Output should be:
      // # Analysis
      // <thinking>
      // ... content ...
      // </thinking>
    });
  });
});
