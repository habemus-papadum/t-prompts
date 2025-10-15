/**
 * StringWithMapping - Build a string while tracking character positions
 *
 * This class constructs a markdown string and tracks which character ranges
 * correspond to which element IDs. This enables mapping from string positions
 * to code view elements and vice versa.
 */

/**
 * Position range for a string segment
 */
interface PositionRange {
  start: number;
  end: number;
}

/**
 * StringWithMapping class
 *
 * Builds a string incrementally while tracking the position of each
 * appended segment by element ID.
 */
export class StringWithMapping {
  private text: string = '';
  private positions: Map<string, PositionRange> = new Map();

  /**
   * Append text for an element and track its position
   *
   * @param elementId - The element ID this text belongs to
   * @param content - The text to append
   */
  append(elementId: string, content: string): void {
    const start = this.text.length;
    this.text += content;
    const end = this.text.length;

    this.positions.set(elementId, { start, end });
  }

  /**
   * Get the complete string
   */
  getText(): string {
    return this.text;
  }

  /**
   * Get all position mappings
   */
  getPositions(): Map<string, PositionRange> {
    return this.positions;
  }

  /**
   * Get the position range for a specific element ID
   */
  getRange(elementId: string): PositionRange | null {
    return this.positions.get(elementId) || null;
  }

  /**
   * Find which element ID contains a given string position
   *
   * @param pos - Character position in the string
   * @returns Element ID containing this position, or null if not found
   */
  getElementAtPosition(pos: number): string | null {
    for (const [id, range] of this.positions.entries()) {
      if (pos >= range.start && pos < range.end) {
        return id;
      }
    }
    return null;
  }

  /**
   * Get all elements that overlap with a given range
   *
   * @param start - Start position
   * @param end - End position
   * @returns Array of element IDs that overlap this range
   */
  getElementsInRange(start: number, end: number): string[] {
    const results: string[] = [];

    for (const [id, range] of this.positions.entries()) {
      // Check if ranges overlap: range1.start < range2.end && range2.start < range1.end
      if (range.start < end && start < range.end) {
        results.push(id);
      }
    }

    return results;
  }

  /**
   * Get the length of the current string
   */
  getLength(): number {
    return this.text.length;
  }

  /**
   * Debug: Get a summary of all positions
   */
  debugPositions(): string {
    const lines: string[] = ['String positions:'];

    for (const [id, range] of this.positions.entries()) {
      const content = this.text.substring(range.start, range.end);
      const preview = content.length > 30
        ? content.substring(0, 30) + '...'
        : content;
      lines.push(
        `  ${id}: [${range.start}, ${range.end}] "${preview.replace(/\n/g, '\\n')}"`
      );
    }

    return lines.join('\n');
  }
}
