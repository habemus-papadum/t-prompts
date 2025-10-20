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

## Folding Integration Follow-up

While integrating the fix with the folding controller we discovered an adjacent
problem: the collapse/expand handlers assume the DOM already matches the
pre-wrap structure. When we previously wrapped a span, collapsing it would hide
the container but the controller then inserted or removed additional siblings
without re-running the wrapping pass. This left the DOM partially unwrapped and
the chunks map pointing at stale nodes.

We now explicitly unwrap the affected subtree before mutating it, run the
collapse/expand logic, and then reapply the wrapping transform. This guarantees
that subsequent operations always observe the canonical structure.

The unwrapping helper also needed to mirror the wrapping pass more faithfully.
Wrap containers clone inline styles onto the replacement spans; without doing
the same in the reverse direction, `display: none` or colouring applied by the
folding UI would be lost during an unwrap→wrap cycle. The transform now copies
`style.cssText` both when wrapping and when unwrapping so hidden chunks stay
hidden and any inline formatting survives round-trips.

## Next Steps

No additional changes are required to stabilise the current behaviour, but
experimenting with a dynamic chunk lookup would make it easier to prototype more
invasive transforms without worrying about metadata bookkeeping.

## Additional Follow-up: Image Chunk Truncation

Re-running the folding workflows surfaced an unrelated but long-standing bug in
the `imageTruncate` transform. The transform iterated the `chunks` map as if
each entry held a single `HTMLElement`, but the map actually stores arrays of
top-level nodes. As a result the code wrote the truncated string to an array
object instead of the DOM node, leaving the original `data:` URL visible in the
CodeView. The transform now loops over every tracked element in the array and
updates their text content and attributes directly. New unit and integration
tests cover both the transform and the folding round-trip to ensure image chunks
remain truncated before and after a collapse/expand cycle.
