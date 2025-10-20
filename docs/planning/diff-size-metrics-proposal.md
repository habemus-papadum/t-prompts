# Diff Size Metrics Proposal

This document proposes quantitative metrics for estimating the size of changes reported by the widget’s structural and rendered diff visualisations. The goal is to give downstream automation (e.g. AI assistants) actionable signals about how large a set of edits is, so that instruction-following policies can reason about whether a change was “small enough”.

## Motivation

- Instruction-following prompts often impose limits such as “only tweak copy” or “avoid major restructuring”.
- Humans reviewing diffs need quick heuristics to identify surprising churn.
- AI copilots benefit from numeric feedback so they can self-assess whether they overstepped.

Because “size” is subjective, we prefer providing a small vector of complementary metrics rather than a single scalar. Consumers can combine or threshold them based on their own tolerance for risk. The sections below outline reasonable first-pass measurements for structural and rendered diffs.

> **Implementation note:** Structured prompts are cloned before mutation, so element and chunk UUIDs differ between snapshots even when nothing else changes. Any metric or matching logic must therefore rely on stable structural signals (keys, paths, rendered text) rather than raw IDs.

## Structural Diff Metrics

Structural diffs operate on the IR graph of prompt elements. We propose the following metrics:

### 1. Edit Volume

- Count of node operations (insert, delete, replace).
- Attribute-only updates (e.g. text tweak without changing children) can optionally weigh at 0.5 to distinguish pure topology changes.
- Report as `struct_edit_count`.

### 2. Span Impact

- Sum the character lengths of structural nodes whose payload changes (e.g. altered text blocks).
- Normalise by total characters in the original prompt to yield `struct_char_ratio`.
- Helps identify edits that touched large sections even if node counts stay low.

### 3. Chunk Reordering

- For nodes that exist in both versions, compute a normalised Kendall-τ distance between their chunk orderings.
- Produces `struct_order_score ∈ [0,1]`, separating “same content, different order” cases.

### 4. Composite (Optional)

- Provide a convenience scalar such as `0.4*struct_edit_count + 0.4*log1p(struct_span_chars) + 0.2*struct_order_score`.
- Users can ignore it and work directly with the vector `(edit_count, span_chars, order_score)` if finer control is desired.

## Rendered Diff Metrics

Rendered diffs compare final Markdown/HTML output. We propose:

### 1. Visible Token Delta

- Count inserted plus deleted tokens (words, or sentencepiece-sized fragments).
- Ignores reflowed whitespace to highlight user-visible copy changes.
- Expose as `render_token_delta`.

### 2. Non-whitespace vs Whitespace Split

- Record both `render_non_ws_delta` and `render_ws_delta` to distinguish formatting-only churn from semantic edits.
- Allows policy like “≤10 non-whitespace tokens but unlimited spacing fixes”.

### 3. Chunk Drift

- Treat each rendered region as annotated by chunk IDs and compute a Jaccard distance between old/new chunk sets.
- Captures content moving between positions even if the textual surface stays the same.
- Report as `render_chunk_drift ∈ [0,1]`.

### 4. Optional Composite

- Example scalar: `0.5*render_non_ws_delta + 0.3*render_ws_delta + 0.2*render_chunk_drift`.
- As with structural metrics, the raw vector provides the most flexibility.

## Usage Guidance

- Present both structural and rendered vectors in the UI/API so consumers can plot or threshold each dimension.
- Highlight the Pareto frontier of edits (e.g. small structural but large rendered) to spot suspicious combinations.
- Provide sensible defaults (e.g. warn when `struct_edit_count > 5` or `render_non_ws_delta > 20`) but let projects tune them.
***
