# Line Wrap Transform Investigation

## Overview
While examining the line wrapping transform we focused on two areas:

1. The wrapping/unwrapping algorithms themselves.
2. How the `chunkId → elements` map stays in sync with DOM mutations.

## Findings

### Premature traversal exit during wrapping
`processElement` returned the next node to visit by walking to the rightmost leaf inside the wrapper and reading its `nextElementSibling`. Because the rightmost node lives inside the wrapper, its sibling is almost always `null`. As soon as a chunk needed wrapping, the traversal stopped processing siblings that followed the wrapped element. This manifested as:

- Later chunks never being considered for wrapping at all.
- Per-chunk metadata staying tied to stale DOM nodes because the subsequent elements were never visited or updated.

### Chunk map drift
The transforms mutated the DOM incrementally and attempted to keep the `chunks` map updated via targeted replacements. Any missed replacement—or new wrappers introducing nested spans that also carried `data-chunk-id`—left the map referencing elements that were no longer top-level containers. This made downstream operations (typing, folding, boundaries) fragile.

## Implemented Fixes

- The wrapping traversal now resumes at `container.nextElementSibling`, ensuring every sibling is processed even after a wrap occurs.
- Added `rebuildChunksMap`, a helper that rebuilds the chunk map by scanning the DOM and keeping only the highest-level element per chunk. `applyTransform_LineWrap` and `unwrapLineWrapping` both call this helper so the map always reflects the current structure, trading a small amount of extra work for correctness.
- Added regression tests that cover multi-sibling wrapping and the unwrap path so the issues stay fixed.

## Future Considerations

- The new `rebuildChunksMap` helper can be reused by other transforms that make structural edits; doing so would reduce the risk of stale entries elsewhere.
- Once the wrapping behaviour stabilises, we can profile the rebuild to decide whether selective updates are still desirable or whether the simpler rebuilding logic is sufficient long term.
