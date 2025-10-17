# Line Wrap Transform Investigation

## Summary
- Identified a traversal bug in `applyTransform_LineWrap` where the wrapping pass stopped iterating once it wrapped an element, leaving any subsequent siblings unprocessed.
- Added a regression test that reproduces the skipped-sibling scenario and verifies that wrapping continues across the remaining chunks.
- Documented an interim mitigation strategy and an alternative design that avoids relying on the pre-computed chunk-to-element map by scanning the DOM on demand.

## Observations
The line wrap transform iterates across the top-level children in the code view container, tracking a `currentElement`. When a chunk exceeds the column limit, the transform replaces the chunk span with a `tp-wrap-container` element and then determines which node should be processed next.

Previously, `processElement` attempted to continue iteration by returning the next sibling of the rightmost leaf node inside the newly created container. In a multi-line wrap scenario, that leaf node has no siblings, so the transform returned `null`. As a result, the outer loop terminated early and all subsequent chunks in the container were skipped. The chunk-to-top-element map still pointed at the new container, but later transforms never visited the remaining siblings, leading to inconsistent wrapping and stale folding state.

## Fix
The transform now resumes iteration from the wrapper container's next sibling in the parent list, ensuring the pipeline continues across the rest of the chunks. A new Vitest case (`should continue processing siblings after wrapping an element`) exercises a three-chunk example where the second chunk would previously be skipped, protecting against regressions.

## Future Improvement: Dynamic Chunk Lookups
During the investigation we considered replacing the pre-computed `Map<chunkId, HTMLElement[]>` with a lightweight DOM query. Because the chunk trees are shallow, it would be feasible to locate the current top-level elements for a chunk by scanning the code view container for `span[data-chunk-id="<chunk>"]` whenever needed. This would eliminate the need to keep the map in sync while experimenting with transforms.

If further inconsistencies surface, a diagnostic mode could switch `CodeView` to recompute chunk associations on demand:

1. Iterate over the code view root children and collect spans that expose `data-chunk-id`.
2. Group them by chunk identifier and use that map for downstream logic.
3. (Optional) Retain the existing map only for performance-critical paths, while the dynamic scan serves as a correctness backstop during development.

For now the simpler iteration fix restores wrapping behaviour, but a dynamic lookup remains a viable fallback while debugging more complex mutations.
