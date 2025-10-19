import type { WidgetData, WidgetMetadata, ElementData } from '../types';

export interface TreeNodeDescriptor {
  id: string;
  type: string;
  key: string;
  ownChunkIds: string[];
  allChunkIds: string[];
  totalCharacters: number;
  totalPixels: number;
  children: TreeNodeDescriptor[];
}

export interface TreeDataSource {
  getRoots(): TreeNodeDescriptor[];
}

export interface PromptTreeOptions {
  treeShowWhitespace: 'default' | 'always' | 'never';
}

export function createPromptTreeDataSource(
  data: WidgetData,
  metadata: WidgetMetadata,
  options: PromptTreeOptions
): TreeDataSource {
  const chunkSizeMap = metadata.chunkSizeMap ?? {};
  const treeShowWhitespace = options.treeShowWhitespace;

  function buildTree(): TreeNodeDescriptor[] {
    const rootElements = data.source_prompt?.children ?? [];
    const chunks = data.ir?.chunks ?? [];
    const chunkMap = new Map<string, string[]>();
    const chunkTextMap = new Map<string, string>();

    for (const chunk of chunks) {
      if (!chunk.element_id) {
        continue;
      }
      if (!chunkMap.has(chunk.element_id)) {
        chunkMap.set(chunk.element_id, []);
      }
      chunkMap.get(chunk.element_id)!.push(chunk.id);

      if (chunk.text !== undefined) {
        chunkTextMap.set(chunk.id, chunk.text);
      }
    }

    function visit(element: ElementData): TreeNodeDescriptor | null {
      const ownChunkIds = chunkMap.get(element.id) ?? [];

      let key: string;
      if (element.type === 'static' && ownChunkIds.length > 0) {
        const texts = ownChunkIds
          .map((chunkId) => chunkTextMap.get(chunkId) ?? '')
          .filter((text) => text !== undefined);
        const fullText = texts.join('');

        const isWhitespaceOnly = fullText.trim().length === 0;

        if (isWhitespaceOnly) {
          if (treeShowWhitespace === 'never') {
            return null;
          }
          if (treeShowWhitespace === 'default' && fullText.length > 0) {
            return null;
          }

          key = renderWhitespace(fullText);
        } else {
          key = fullText || String(element.key);
        }
      } else {
        key = String(element.key);
      }

      const children = (element.children ?? [])
        .map((child) => visit(child))
        .filter((node): node is TreeNodeDescriptor => node !== null);

      const allChunkIdSet = new Set<string>(ownChunkIds);
      for (const child of children) {
        for (const childChunkId of child.allChunkIds) {
          allChunkIdSet.add(childChunkId);
        }
      }

      let totalCharacters = 0;
      let totalPixels = 0;
      for (const chunkId of allChunkIdSet) {
        const size = chunkSizeMap[chunkId];
        if (!size) {
          continue;
        }
        totalCharacters += size.character ?? 0;
        totalPixels += size.pixel ?? 0;
      }

      if (element.type === 'static' && treeShowWhitespace !== 'always' && totalCharacters === 0 && totalPixels === 0) {
        return null;
      }

      return {
        id: element.id,
        type: element.type,
        key,
        ownChunkIds,
        allChunkIds: Array.from(allChunkIdSet),
        totalCharacters,
        totalPixels,
        children,
      };
    }

    return rootElements
      .map((element) => visit(element))
      .filter((node): node is TreeNodeDescriptor => node !== null);
  }

  return {
    getRoots(): TreeNodeDescriptor[] {
      return buildTree();
    },
  };
}

function renderWhitespace(text: string): string {
  if (text.length === 0) {
    return '(empty)';
  }

  return text.replace(/\n/g, '¶').replace(/ /g, '□').replace(/\t/g, '⇥');
}
