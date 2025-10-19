import type { DiffContext } from '../types';
import type { TreeOverlay } from './TreeView';
import type { NodeDelta } from '../diff-types';

function buildStatusMap(root: NodeDelta): Map<string, string> {
  const map = new Map<string, string>();

  const stack: NodeDelta[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.after_id) {
      map.set(node.after_id, node.status);
    }
    for (const child of node.children) {
      stack.push(child);
    }
  }

  return map;
}

export function createDiffTreeOverlay(context: DiffContext): TreeOverlay {
  const statusMap = buildStatusMap(context.structured.root);

  return {
    decorate(node, row) {
      const status = statusMap.get(node.id);
      if (!status) {
        return;
      }

      row.dataset.diffStatus = status;
      row.classList.add(`tp-tree-diff-${status}`);
    },
  };
}
