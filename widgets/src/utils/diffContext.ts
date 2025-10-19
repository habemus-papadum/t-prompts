import type { DiffContext, DiffContextPayload, IRData, WidgetData, ChunkData } from '../types';

function buildChunkLookups(ir: IRData | undefined): {
  chunkMap: Record<string, ChunkData>;
  elementChunks: Record<string, string[]>;
} {
  const chunkMap: Record<string, ChunkData> = {};
  const elementChunks: Record<string, string[]> = {};

  if (!ir?.chunks) {
    return { chunkMap, elementChunks };
  }

  for (const chunk of ir.chunks) {
    chunkMap[chunk.id] = chunk;

    if (!chunk.element_id) {
      continue;
    }

    if (!elementChunks[chunk.element_id]) {
      elementChunks[chunk.element_id] = [];
    }

    elementChunks[chunk.element_id].push(chunk.id);
  }

  return { chunkMap, elementChunks };
}

function resolvePayload(data: WidgetData): DiffContextPayload | null {
  if (data.diff_context) {
    return data.diff_context;
  }

  if (data.before_prompt_ir && data.structured_diff && data.rendered_diff) {
    return {
      before_prompt_ir: data.before_prompt_ir,
      structured_diff: data.structured_diff,
      rendered_diff: data.rendered_diff,
    };
  }

  return null;
}

/**
 * Extract a structured diff context from widget data if the payload includes diff metadata.
 */
export function getDiffContext(data: WidgetData): DiffContext | null {
  const payload = resolvePayload(data);
  if (!payload || !data.ir) {
    return null;
  }

  const { chunkMap: beforeChunkMap, elementChunks: beforeElementChunks } = buildChunkLookups(
    payload.before_prompt_ir
  );
  const { chunkMap: afterChunkMap, elementChunks: afterElementChunks } = buildChunkLookups(data.ir);

  return {
    beforePrompt: payload.before_prompt_ir,
    afterPrompt: data.ir,
    structured: payload.structured_diff,
    rendered: payload.rendered_diff,
    beforeChunkMap,
    afterChunkMap,
    beforeElementChunks,
    afterElementChunks,
  };
}
