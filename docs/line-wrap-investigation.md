# Line Wrap Transform Investigation

## Summary

During debugging of the `lineWrap` transform we identified two structural issues that
explained the inconsistencies observed when wrapping and unwrapping code chunks:

1. **Traversal stopped after the first wrapped element.** The loop that walks the
   top-level spans advanced using the rightmost child inside the newly created
   wrap container. That child never has siblings, so the traversal terminated
   prematurely. Downstream transforms then observed stale `chunks` metadata and
   partially wrapped DOM trees.
2. **Wrapping with no remaining columns re-used the previous line.** When a line
   was already at the column limit, the next element was split at the column
   width instead of zero. This caused the first characters of the element to be
   rendered on the previous line, exceeding the intended width and creating
   asymmetric structures that the unwrap routine struggled to reverse cleanly.

## Implemented Fix

To restore a consistent tree structure we made the following adjustments:

- The traversal now resumes from the wrap container's next sibling rather than
  the rightmost child. This keeps the iteration aligned with the top-level DOM
  structure and ensures every following chunk is considered.
- The split index calculation now treats exhausted columns as a mandatory line
  break (`splitIndex = 0`). The wrapping helper was updated to tolerate empty
  prefixes so we can emit a `<br>` directly followed by the continuation span.
  This guarantees that the wrapped output respects the column boundary and that
  the unwrap logic reconstructs the original content without stray characters.
- Additional unit tests exercise both scenarios to guard against regressions and
  confirm that the `chunks` map points at the newly wrapped containers.

## Notes on Chunk Tracking

The investigation did not reveal fundamental problems with maintaining the
pre-computed chunk map—our stale references stemmed from the traversal bug. That
said, a dynamic lookup (e.g., scanning from the root for matching `data-chunk-id`
attributes) remains an attractive simplification while iterating on the DOM
structure. If future refactors require more flexibility we can introduce such a
helper alongside or instead of the map.

## Next Steps

No additional changes are required to stabilise the current behaviour, but
experimenting with a dynamic chunk lookup would make it easier to prototype more
invasive transforms without worrying about metadata bookkeeping.
