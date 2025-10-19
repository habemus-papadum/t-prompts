"""Diff utilities for StructuredPrompt trees and rendered outputs."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from itertools import zip_longest
from typing import Any, Iterable, Literal, Optional

from .element import Element, ImageInterpolation, ListInterpolation, Static, TextInterpolation
from .ir import ImageChunk, TextChunk
from .structured_prompt import StructuredPrompt

DiffStatus = Literal["equal", "modified", "inserted", "deleted", "moved"]
ChunkOp = Literal["equal", "insert", "delete", "replace"]


@dataclass(slots=True)
class TextEdit:
    """Atomic text edit for leaf comparisons."""

    op: Literal["equal", "insert", "delete", "replace"]
    before: str
    after: str

    def added_chars(self) -> int:
        return len(self.after) if self.op in {"insert", "replace"} else 0

    def removed_chars(self) -> int:
        return len(self.before) if self.op in {"delete", "replace"} else 0


@dataclass(slots=True)
class NodeDelta:
    """Diff result for a single Element node."""

    status: DiffStatus
    element_type: str
    key: Any
    before_id: Optional[str]
    after_id: Optional[str]
    before_index: Optional[int]
    after_index: Optional[int]
    attr_changes: dict[str, tuple[Any, Any]] = field(default_factory=dict)
    text_edits: list[TextEdit] = field(default_factory=list)
    children: list["NodeDelta"] = field(default_factory=list)

    def summarize(self) -> dict[str, int]:
        stats = {"added": 0, "removed": 0, "modified": 0, "moved": 0}
        self._accumulate(stats)
        return stats

    def _accumulate(self, stats: dict[str, int]) -> None:
        if self.status == "inserted":
            stats["added"] += 1
        elif self.status == "deleted":
            stats["removed"] += 1
        elif self.status == "modified":
            stats["modified"] += 1
        elif self.status == "moved":
            stats["moved"] += 1
        for child in self.children:
            child._accumulate(stats)


@dataclass(slots=True)
class DiffStats:
    """Aggregate statistics for a StructuredPrompt diff."""

    nodes_added: int = 0
    nodes_removed: int = 0
    nodes_modified: int = 0
    nodes_moved: int = 0
    text_added: int = 0
    text_removed: int = 0


@dataclass(slots=True)
class StructuralDiffMetrics:
    """Quantitative metrics describing structural diff size."""

    struct_edit_count: float = 0.0
    struct_span_chars: int = 0
    struct_char_ratio: float = 0.0
    struct_order_score: float = 0.0


@dataclass(slots=True)
class RenderedDiffMetrics:
    """Quantitative metrics describing rendered diff size."""

    render_token_delta: int = 0
    render_non_ws_delta: int = 0
    render_ws_delta: int = 0
    render_chunk_drift: float = 0.0


@dataclass(slots=True)
class StructuredPromptDiff:
    """Result of comparing two StructuredPrompt instances."""

    before: StructuredPrompt
    after: StructuredPrompt
    root: NodeDelta
    stats: DiffStats
    metrics: StructuralDiffMetrics

    def to_widget_data(self) -> dict[str, Any]:
        """
        Convert diff to widget data for TypeScript rendering.

        Returns
        -------
        dict[str, Any]
            JSON-serializable dictionary with diff data.
        """
        return {
            "diff_type": "structured",
            "root": _serialize_node_delta(self.root),
            "stats": {
                "nodes_added": self.stats.nodes_added,
                "nodes_removed": self.stats.nodes_removed,
                "nodes_modified": self.stats.nodes_modified,
                "nodes_moved": self.stats.nodes_moved,
                "text_added": self.stats.text_added,
                "text_removed": self.stats.text_removed,
            },
            "metrics": {
                "struct_edit_count": self.metrics.struct_edit_count,
                "struct_span_chars": self.metrics.struct_span_chars,
                "struct_char_ratio": self.metrics.struct_char_ratio,
                "struct_order_score": self.metrics.struct_order_score,
            },
        }

    def _repr_html_(self) -> str:
        """Return HTML representation for Jupyter notebook display."""
        from .widgets import _render_widget_html

        data = self.to_widget_data()
        return _render_widget_html(data, "tp-sp-diff-mount")

    def __str__(self) -> str:
        """Return simple string representation showing diff statistics."""
        return (
            f"StructuredPromptDiff("
            f"nodes_added={self.stats.nodes_added}, "
            f"nodes_removed={self.stats.nodes_removed}, "
            f"nodes_modified={self.stats.nodes_modified}, "
            f"nodes_moved={self.stats.nodes_moved}, "
            f"text_added={self.stats.text_added}, "
            f"text_removed={self.stats.text_removed}, "
            f"struct_edit_count={self.metrics.struct_edit_count:.1f}, "
            f"struct_span_chars={self.metrics.struct_span_chars}, "
            f"struct_char_ratio={self.metrics.struct_char_ratio:.3f}, "
            f"struct_order_score={self.metrics.struct_order_score:.3f})"
        )

    def __repr__(self) -> str:
        """Return string representation."""
        return self.__str__()


@dataclass(slots=True)
class ChunkDelta:
    """Chunk-level diff entry for rendered prompts."""

    op: ChunkOp
    before: TextChunk | ImageChunk | None
    after: TextChunk | ImageChunk | None

    def text_delta(self) -> tuple[int, int]:
        added = len(self.after.text) if self.after is not None else 0
        removed = len(self.before.text) if self.before is not None else 0
        return added if self.op in {"insert", "replace"} else 0, removed if self.op in {"delete", "replace"} else 0


@dataclass(slots=True)
class ElementRenderChange:
    """Aggregated chunk operations for a single element."""

    element_id: str
    inserts: int = 0
    deletes: int = 0
    replaces: int = 0
    equals: int = 0
    text_added: int = 0
    text_removed: int = 0


@dataclass(slots=True)
class RenderedPromptDiff:
    """Diff between two rendered prompt intermediate representations."""

    before: StructuredPrompt
    after: StructuredPrompt
    chunk_deltas: list[ChunkDelta]
    per_element: dict[str, ElementRenderChange]
    metrics: RenderedDiffMetrics

    def to_widget_data(self) -> dict[str, Any]:
        """
        Convert diff to widget data for TypeScript rendering.

        Returns
        -------
        dict[str, Any]
            JSON-serializable dictionary with diff data.
        """
        return {
            "diff_type": "rendered",
            "chunk_deltas": [
                {
                    "op": delta.op,
                    "before": (
                        {
                            "text": delta.before.text,
                            "element_id": delta.before.element_id,
                            "chunk_id": delta.before.id,
                        }
                        if delta.before
                        else None
                    ),
                    "after": (
                        {
                            "text": delta.after.text,
                            "element_id": delta.after.element_id,
                            "chunk_id": delta.after.id,
                        }
                        if delta.after
                        else None
                    ),
                }
                for delta in self.chunk_deltas
            ],
            "stats": self.stats(),
            "metrics": {
                "render_token_delta": self.metrics.render_token_delta,
                "render_non_ws_delta": self.metrics.render_non_ws_delta,
                "render_ws_delta": self.metrics.render_ws_delta,
                "render_chunk_drift": self.metrics.render_chunk_drift,
            },
        }

    def stats(self) -> dict[str, int]:
        inserts = sum(1 for delta in self.chunk_deltas if delta.op == "insert")
        deletes = sum(1 for delta in self.chunk_deltas if delta.op == "delete")
        replaces = sum(1 for delta in self.chunk_deltas if delta.op == "replace")
        equals = sum(1 for delta in self.chunk_deltas if delta.op == "equal")
        return {
            "insert": inserts,
            "delete": deletes,
            "replace": replaces,
            "equal": equals,
        }

    def _repr_html_(self) -> str:
        """Return HTML representation for Jupyter notebook display."""
        from .widgets import _render_widget_html

        data = self.to_widget_data()
        return _render_widget_html(data, "tp-rendered-diff-mount")

    def __str__(self) -> str:
        """Return simple string representation showing chunk operation counts."""
        stats = self.stats()
        return (
            f"RenderedPromptDiff("
            f"insert={stats['insert']}, "
            f"delete={stats['delete']}, "
            f"replace={stats['replace']}, "
            f"equal={stats['equal']}, "
            f"render_token_delta={self.metrics.render_token_delta}, "
            f"render_ws_delta={self.metrics.render_ws_delta}, "
            f"render_chunk_drift={self.metrics.render_chunk_drift:.3f})"
        )

    def __repr__(self) -> str:
        """Return string representation."""
        return self.__str__()


def diff_structured_prompts(before: StructuredPrompt, after: StructuredPrompt) -> StructuredPromptDiff:
    """Compute a structural diff between two StructuredPrompt trees."""

    root = _align_nodes(before, after)
    stats = DiffStats()
    _collect_stats(root, stats)
    metrics = _compute_structural_metrics(before, root)
    return StructuredPromptDiff(before=before, after=after, root=root, stats=stats, metrics=metrics)


def diff_rendered_prompts(before: StructuredPrompt, after: StructuredPrompt) -> RenderedPromptDiff:
    """Compute a diff of the rendered intermediate representations."""

    before_chunks = before.ir().chunks
    after_chunks = after.ir().chunks
    before_signatures = _build_element_signature_map(before)
    after_signatures = _build_element_signature_map(after)
    deltas = _diff_chunks(before_chunks, after_chunks, before_signatures, after_signatures)
    per_element: dict[str, ElementRenderChange] = {}
    for delta in deltas:
        element_id = _chunk_element(delta)
        if not element_id:
            continue
        summary = per_element.setdefault(element_id, ElementRenderChange(element_id))
        if delta.op == "equal":
            summary.equals += 1
        elif delta.op == "insert":
            summary.inserts += 1
        elif delta.op == "delete":
            summary.deletes += 1
        elif delta.op == "replace":
            summary.replaces += 1
        added, removed = delta.text_delta()
        summary.text_added += added
        summary.text_removed += removed
    metrics = _compute_rendered_metrics(before_chunks, after_chunks, before_signatures, after_signatures)
    return RenderedPromptDiff(
        before=before,
        after=after,
        chunk_deltas=deltas,
        per_element=per_element,
        metrics=metrics,
    )


# Internal helpers ------------------------------------------------------------------


def _collect_stats(delta: NodeDelta, stats: DiffStats) -> None:
    if delta.status == "inserted":
        stats.nodes_added += 1
    elif delta.status == "deleted":
        stats.nodes_removed += 1
    elif delta.status == "modified":
        stats.nodes_modified += 1
    elif delta.status == "moved":
        stats.nodes_moved += 1

    for edit in delta.text_edits:
        stats.text_added += edit.added_chars()
        stats.text_removed += edit.removed_chars()

    for child in delta.children:
        _collect_stats(child, stats)


def _compute_structural_metrics(before: StructuredPrompt, root: NodeDelta) -> StructuralDiffMetrics:
    """Derive quantitative metrics summarizing structural diff magnitude."""

    total_chars = _total_rendered_characters(before)
    span_chars = 0
    edit_count = 0.0
    matched_nodes = 0
    moved_nodes = 0

    def visit(delta: NodeDelta) -> None:
        nonlocal span_chars, edit_count, matched_nodes, moved_nodes

        has_child_changes = any(child.status != "equal" for child in delta.children)
        has_attr_changes = bool(delta.attr_changes)
        has_text_changes = bool(delta.text_edits)

        weight = 0.0
        if delta.status in {"inserted", "deleted", "moved"}:
            weight = 1.0
        elif delta.status == "modified":
            weight = 1.0 if has_child_changes else 0.5

        edit_count += weight

        if delta.before_id is not None and delta.after_id is not None:
            matched_nodes += 1
            if (
                delta.before_index is not None
                and delta.after_index is not None
                and delta.before_index != delta.after_index
            ):
                moved_nodes += 1

        if has_text_changes or has_attr_changes:
            for edit in delta.text_edits:
                if edit.op == "equal":
                    continue
                if edit.op == "insert":
                    span_chars += len(edit.after)
                elif edit.op == "delete":
                    span_chars += len(edit.before)
                else:  # replace
                    span_chars += max(len(edit.before), len(edit.after))

        for child in delta.children:
            visit(child)

    visit(root)

    char_ratio = span_chars / total_chars if total_chars > 0 else 0.0
    order_score = (moved_nodes / matched_nodes) if matched_nodes > 0 else 0.0

    return StructuralDiffMetrics(
        struct_edit_count=edit_count,
        struct_span_chars=span_chars,
        struct_char_ratio=char_ratio,
        struct_order_score=order_score,
    )


def _align_nodes(before: Optional[Element], after: Optional[Element]) -> NodeDelta:
    if before is None and after is None:  # pragma: no cover - defensive guard
        raise ValueError("Cannot diff two empty nodes")

    if before is None:
        return NodeDelta(
            status="inserted",
            element_type=type(after).__name__,
            key=after.key,
            before_id=None,
            after_id=after.id,
            before_index=None,
            after_index=after.index,
        )

    if after is None:
        return NodeDelta(
            status="deleted",
            element_type=type(before).__name__,
            key=before.key,
            before_id=before.id,
            after_id=None,
            before_index=before.index,
            after_index=None,
        )

    if type(before) is not type(after):
        return NodeDelta(
            status="modified",
            element_type=f"{type(before).__name__}→{type(after).__name__}",
            key=after.key,
            before_id=before.id,
            after_id=after.id,
            before_index=before.index,
            after_index=after.index,
        )

    attr_changes = _compare_attributes(before, after)
    text_edits = _diff_text(before, after)
    child_pairs = _match_children(_iter_children(before), _iter_children(after))
    child_deltas = [_align_nodes(b, a) for b, a in child_pairs]

    status: DiffStatus = "equal"
    moved = before.index != after.index
    if moved:
        status = "moved"
    if attr_changes or text_edits:
        status = "modified"
    if any(child.status != "equal" for child in child_deltas):
        status = "modified" if status == "equal" else status

    return NodeDelta(
        status=status,
        element_type=type(after).__name__,
        key=after.key,
        before_id=before.id,
        after_id=after.id,
        before_index=before.index,
        after_index=after.index,
        attr_changes=attr_changes,
        text_edits=text_edits,
        children=child_deltas,
    )


def _compare_attributes(before: Element, after: Element) -> dict[str, tuple[Any, Any]]:
    fields = {"expression", "conversion", "format_spec", "render_hints"}
    if isinstance(before, ListInterpolation) and isinstance(after, ListInterpolation):
        fields.add("separator")
    if isinstance(before, (Static, TextInterpolation)) and isinstance(after, (Static, TextInterpolation)):
        # value handled separately for text diff
        pass
    elif isinstance(before, ImageInterpolation) and isinstance(after, ImageInterpolation):
        fields.add("value")

    changes: dict[str, tuple[Any, Any]] = {}
    for field_name in fields:
        before_value = getattr(before, field_name, None)
        after_value = getattr(after, field_name, None)
        if before_value != after_value:
            changes[field_name] = (before_value, after_value)
    return changes


def _diff_text(before: Element, after: Element) -> list[TextEdit]:
    if isinstance(before, Static) and isinstance(after, Static):
        return _diff_strings(before.value, after.value)
    if isinstance(before, TextInterpolation) and isinstance(after, TextInterpolation):
        return _diff_strings(before.value, after.value)
    return []


def _diff_strings(before: str, after: str) -> list[TextEdit]:
    if before == after:
        return []

    # Simple character-level diff using SequenceMatcher to keep implementation lightweight
    from difflib import SequenceMatcher

    matcher = SequenceMatcher(a=before, b=after, autojunk=False)
    edits: list[TextEdit] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        edits.append(TextEdit(tag, before[i1:i2], after[j1:j2]))
    return edits


def _iter_children(element: Element) -> Iterable[Element]:
    if isinstance(element, StructuredPrompt):
        return element.children
    if isinstance(element, ListInterpolation):
        return element.item_elements
    return ()


def _match_children(
    before_children: Iterable[Element], after_children: Iterable[Element]
) -> list[tuple[Optional[Element], Optional[Element]]]:
    before_list = list(before_children)
    after_list = list(after_children)

    lookup: dict[tuple[Any, type], list[tuple[int, Element]]] = {}
    for idx, child in enumerate(after_list):
        lookup.setdefault((child.key, type(child)), []).append((idx, child))

    used_after: set[int] = set()
    pairs: list[tuple[Optional[Element], Optional[Element]]] = []

    for before_child in before_list:
        bucket = lookup.get((before_child.key, type(before_child)))
        if bucket:
            idx, match = bucket.pop(0)
            used_after.add(idx)
            pairs.append((before_child, match))
        else:
            pairs.append((before_child, None))

    for idx, child in enumerate(after_list):
        if idx not in used_after:
            pairs.append((None, child))

    return pairs


def _diff_chunks(
    before: Iterable[TextChunk | ImageChunk],
    after: Iterable[TextChunk | ImageChunk],
    before_signatures: dict[str, tuple[str, ...]],
    after_signatures: dict[str, tuple[str, ...]],
) -> list[ChunkDelta]:
    from difflib import SequenceMatcher

    before_list = list(before)
    after_list = list(after)
    before_keys = [_chunk_signature(chunk, before_signatures) for chunk in before_list]
    after_keys = [_chunk_signature(chunk, after_signatures) for chunk in after_list]
    matcher = SequenceMatcher(a=before_keys, b=after_keys, autojunk=False)
    deltas: list[ChunkDelta] = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            # Chunks matched by structure, but verify text equality
            for before_chunk, after_chunk in zip(before_list[i1:i2], after_list[j1:j2]):
                if before_chunk.text == after_chunk.text:
                    deltas.append(ChunkDelta("equal", before_chunk, after_chunk))
                else:
                    # Same structure, different text -> replace
                    deltas.append(ChunkDelta("replace", before_chunk, after_chunk))
            continue

        if tag == "replace":
            before_slice = before_list[i1:i2]
            after_slice = after_list[j1:j2]
            for before_chunk, after_chunk in zip_longest(before_slice, after_slice):
                if before_chunk is None:
                    deltas.append(ChunkDelta("insert", None, after_chunk))
                elif after_chunk is None:
                    deltas.append(ChunkDelta("delete", before_chunk, None))
                elif before_chunk.text == after_chunk.text:
                    # Different structure but same text -> still equal
                    deltas.append(ChunkDelta("equal", before_chunk, after_chunk))
                else:
                    deltas.append(ChunkDelta("replace", before_chunk, after_chunk))
            continue

        if tag == "delete":
            for chunk in before_list[i1:i2]:
                deltas.append(ChunkDelta("delete", chunk, None))
            continue

        if tag == "insert":
            for chunk in after_list[j1:j2]:
                deltas.append(ChunkDelta("insert", None, chunk))

    return deltas


def _chunk_element(delta: ChunkDelta) -> Optional[str]:
    if delta.after is not None:
        return delta.after.element_id
    if delta.before is not None:
        return delta.before.element_id
    return None


def _compute_rendered_metrics(
    before_chunks: Iterable[TextChunk | ImageChunk],
    after_chunks: Iterable[TextChunk | ImageChunk],
    before_signatures: dict[str, tuple[str, ...]],
    after_signatures: dict[str, tuple[str, ...]],
) -> RenderedDiffMetrics:
    before_list = list(before_chunks)
    after_list = list(after_chunks)

    before_text = "".join(chunk.text for chunk in before_list if isinstance(chunk, TextChunk))
    after_text = "".join(chunk.text for chunk in after_list if isinstance(chunk, TextChunk))
    non_ws_delta, ws_delta = _token_delta_counts(before_text, after_text)

    before_sig_set = {_chunk_signature(chunk, before_signatures) for chunk in before_list}
    after_sig_set = {_chunk_signature(chunk, after_signatures) for chunk in after_list}
    union = before_sig_set | after_sig_set
    if not union:
        chunk_drift = 0.0
    else:
        chunk_drift = 1.0 - (len(before_sig_set & after_sig_set) / len(union))

    return RenderedDiffMetrics(
        render_token_delta=non_ws_delta,
        render_non_ws_delta=non_ws_delta,
        render_ws_delta=ws_delta,
        render_chunk_drift=chunk_drift,
    )


def _build_element_signature_map(prompt: StructuredPrompt) -> dict[str, tuple[str, ...]]:
    """
    Build a stable signature map for elements within a prompt.

    Chunk IDs change on clone, so we rely on structural paths composed of element type,
    key, and index to align identical content between prompts.
    """

    signatures: dict[str, tuple[str, ...]] = {}

    def visit(element: Element, path: tuple[str, ...]) -> None:
        key_repr = "<root>" if element.key is None else str(element.key)
        segment = f"{type(element).__name__}:{key_repr}:{element.index}"
        current_path = path + (segment,)
        signatures[element.id] = current_path
        for child in _iter_children(element):
            visit(child, current_path)

    visit(prompt, ())
    return signatures


def _chunk_signature(chunk: TextChunk | ImageChunk, signatures: dict[str, tuple[str, ...]]) -> tuple[Any, ...]:
    """
    Generate a signature for chunk matching based on structural position only.

    Text content is intentionally excluded so that chunks at the same structural
    position can be matched together, even if their text differs. Text equality
    is checked separately after matching.
    """
    path = signatures.get(chunk.element_id)
    return (type(chunk).__name__, path)


_TOKEN_SPLIT_PATTERN = re.compile(r"\s+|\S+")


def _token_delta_counts(before_text: str, after_text: str) -> tuple[int, int]:
    """Return counts of non-whitespace and whitespace token churn."""

    from difflib import SequenceMatcher

    before_tokens = _TOKEN_SPLIT_PATTERN.findall(before_text)
    after_tokens = _TOKEN_SPLIT_PATTERN.findall(after_text)
    matcher = SequenceMatcher(a=before_tokens, b=after_tokens, autojunk=False)

    non_ws = 0
    ws = 0

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue

        if tag in {"replace", "delete"}:
            for token in before_tokens[i1:i2]:
                if token.isspace():
                    ws += 1
                else:
                    non_ws += 1

        if tag in {"replace", "insert"}:
            for token in after_tokens[j1:j2]:
                if token.isspace():
                    ws += 1
                else:
                    non_ws += 1

    return non_ws, ws


def _total_rendered_characters(prompt: StructuredPrompt) -> int:
    """Compute total rendered character count for a prompt."""

    ir = prompt.ir()
    total = 0
    for chunk in ir.chunks:
        if isinstance(chunk, TextChunk):
            total += len(chunk.text)
    return total


def _serialize_node_delta(delta: NodeDelta) -> dict[str, Any]:
    """Serialize NodeDelta to JSON-compatible dict."""
    return {
        "status": delta.status,
        "element_type": delta.element_type,
        "key": delta.key,
        "before_id": delta.before_id,
        "after_id": delta.after_id,
        "before_index": delta.before_index,
        "after_index": delta.after_index,
        "attr_changes": {k: list(v) for k, v in delta.attr_changes.items()},
        "text_edits": [{"op": edit.op, "before": edit.before, "after": edit.after} for edit in delta.text_edits],
        "children": [_serialize_node_delta(child) for child in delta.children],
    }
