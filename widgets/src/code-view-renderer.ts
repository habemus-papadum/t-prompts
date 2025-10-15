/**
 * Code View Renderer - Build code view DOM and string in parallel
 *
 * This module walks the IR source_prompt structure and constructs both:
 * 1. Code view DOM with proper nesting and element IDs
 * 2. Markdown string with position tracking
 *
 * Phase 2C: Now includes render hints support (header, XML)
 */

import { CodeViewBuilder } from './code-view-builder';
import { StringWithMapping } from './string-mapper';
import {
  parseRenderHints,
  applyHeaderHint,
  applyXmlHint,
  getNextHeaderLevel,
  capHeaderLevel,
} from './render-hints';

/**
 * Type definitions matching IR JSON structure
 */
interface WidgetData {
  prompt_id?: string;
  children?: ElementData[];
  ir_id?: string;
  source_prompt?: WidgetData;
  chunks?: ChunkData[];
}

interface ElementData {
  type: string;
  id?: string;
  key?: string | number;
  value?: string;
  expression?: string;
  children?: ElementData[];
  separator?: string;
  image_data?: ImageData;
  render_hints?: string;
  [key: string]: unknown;
}

interface ImageData {
  base64_data?: string;
  format?: string;
  width?: number;
  height?: number;
  error?: string;
}

interface ChunkData {
  type: string;
  text?: string;
  image_data?: ImageData;
}

/**
 * Result of rendering code view
 */
export interface CodeViewRenderResult {
  codeViewBuilder: CodeViewBuilder;
  stringMapper: StringWithMapping;
  container: HTMLElement;
  markdownString: string;
}

/**
 * Render code view from IR source_prompt
 *
 * @param data - The IR data (containing source_prompt)
 * @param maxHeaderLevel - Maximum header level (default 4)
 * @returns Render result with DOM and string
 */
export function renderCodeView(
  data: WidgetData,
  maxHeaderLevel: number = 4
): CodeViewRenderResult {
  const codeViewBuilder = new CodeViewBuilder();
  const stringMapper = new StringWithMapping();

  // Use source_prompt if available (IR format), otherwise use data directly
  const sourcePrompt = data.source_prompt || data;

  if (!sourcePrompt.children) {
    console.warn('No children in source prompt');
    return {
      codeViewBuilder,
      stringMapper,
      container: codeViewBuilder.getContainer(),
      markdownString: '',
    };
  }

  // Walk the children and build DOM + string
  let elementCounter = 0;

  function walkChildren(
    children: ElementData[],
    parentId?: string,
    currentHeaderLevel: number = 1
  ): void {
    for (const child of children) {
      const elementId = `elem-${elementCounter++}`;

      // Parse render hints if present
      const hints = child.render_hints
        ? parseRenderHints(child.render_hints, String(child.key ?? ''))
        : {};

      // Determine next header level for nested elements
      const nextHeaderLevel = getNextHeaderLevel(
        currentHeaderLevel,
        !!hints.header
      );

      // Apply render hints in correct order: header (outer), XML (inner)

      // 1. Apply header hint (outer wrapper)
      if (hints.header) {
        const level = capHeaderLevel(currentHeaderLevel, maxHeaderLevel);
        applyHeaderHint(
          codeViewBuilder,
          stringMapper,
          elementId,
          hints.header,
          level
        );
      }

      // 2. Apply XML open tag (inner wrapper)
      if (hints.xml) {
        applyXmlHint(codeViewBuilder, stringMapper, elementId, hints.xml, 'open');
      }

      // 3. Render element content
      if (child.type === 'static') {
        const text = child.value || '';
        codeViewBuilder.addStatic(elementId, child, text, parentId);
        stringMapper.append(elementId, text);
      } else if (child.type === 'interpolation') {
        const value = child.value || '';
        codeViewBuilder.addInterpolation(elementId, child, value, parentId);
        stringMapper.append(elementId, value);
      } else if (child.type === 'image' && child.image_data) {
        // Images appear in code view but NOT in markdown string
        codeViewBuilder.addImage(elementId, child, child.image_data, parentId);
        // Don't append to string - images can't be in markdown text
      } else if (child.type === 'nested_prompt' && child.children) {
        // Create container for nested prompt
        const container = codeViewBuilder.createContainer(
          elementId,
          'nested_prompt',
          child,
          parentId
        );

        // Push context and recurse with updated header level
        codeViewBuilder.pushParent(container);
        walkChildren(child.children, elementId, nextHeaderLevel);
        codeViewBuilder.popParent();
      } else if (child.type === 'list' && child.children) {
        // Create container for list
        const container = codeViewBuilder.createContainer(
          elementId,
          'list',
          child,
          parentId
        );

        codeViewBuilder.pushParent(container);

        // Get separator from hints or default "\n"
        const separator = hints.sep !== undefined ? hints.sep : (child.separator !== undefined ? child.separator : '\n');

        // Render each list item
        for (let i = 0; i < child.children.length; i++) {
          const item = child.children[i];

          // Add separator before items after the first
          if (i > 0) {
            const sepId = `${elementId}-sep-${i}`;
            codeViewBuilder.addStatic(sepId, { type: 'static', key: sepId, value: separator }, elementId);
            stringMapper.append(sepId, separator);
          }

          // Render item children with updated header level
          if (item.children) {
            walkChildren(item.children, elementId, nextHeaderLevel);
          }
        }

        codeViewBuilder.popParent();
      }

      // 4. Apply XML close tag (inner wrapper)
      if (hints.xml) {
        applyXmlHint(codeViewBuilder, stringMapper, elementId, hints.xml, 'close');
      }
    }
  }

  // Start walking from root with initial header level of 1
  walkChildren(sourcePrompt.children, undefined, 1);

  return {
    codeViewBuilder,
    stringMapper,
    container: codeViewBuilder.getContainer(),
    markdownString: stringMapper.getText(),
  };
}

/**
 * Render code view from IR chunks (alternative approach)
 *
 * This is the simpler approach that just renders the chunks directly
 * without reconstructing from source_prompt structure.
 *
 * @param chunks - Array of chunks from IR
 * @returns Render result
 */
export function renderCodeViewFromChunks(chunks: ChunkData[]): CodeViewRenderResult {
  const codeViewBuilder = new CodeViewBuilder();
  const stringMapper = new StringWithMapping();

  let elementCounter = 0;

  for (const chunk of chunks) {
    const elementId = `chunk-${elementCounter++}`;

    if (chunk.type === 'text' && chunk.text) {
      codeViewBuilder.addStatic(
        elementId,
        { type: 'static', key: elementId, value: chunk.text },
        chunk.text
      );
      stringMapper.append(elementId, chunk.text);
    } else if (chunk.type === 'image' && chunk.image_data) {
      codeViewBuilder.addImage(
        elementId,
        { type: 'image', key: elementId, image_data: chunk.image_data },
        chunk.image_data
      );
      // Don't append to string
    }
  }

  return {
    codeViewBuilder,
    stringMapper,
    container: codeViewBuilder.getContainer(),
    markdownString: stringMapper.getText(),
  };
}
