"""Tests for StructuredPrompt diff utilities."""

import t_prompts
from t_prompts import (
    Movement,
    NodeChange,
    diff_rendered_prompts,
    diff_structured_prompts,
)


def _get_child_by_type(diff, element_type):
    for child in diff.children:
        if child.element_type == element_type:
            return child
    raise AssertionError(f"Expected child of type {element_type!r}")


def test_structured_diff_detects_static_text_change():
    """Changing a static segment should produce a replace diff with text details."""

    topic = "diffs"
    before = t_prompts.prompt(t"Intro: {topic:topic}")
    after = t_prompts.prompt(t"Intro updated: {topic:topic}")

    diff = diff_structured_prompts(before, after)

    assert diff.root.change_type is NodeChange.REPLACE
    static_delta = _get_child_by_type(diff.root, "Static")
    assert static_delta.change_type is NodeChange.REPLACE
    assert static_delta.text_diff is not None
    assert static_delta.text_diff.has_changes()
    texts = [op.op for op in static_delta.text_diff.operations]
    assert "insert" in texts or "replace" in texts


def test_structured_diff_detects_insert_delete_and_move():
    """Keyed interpolations should be detected as moved and new keys as insertions."""

    a = "A"
    b = "B"
    c = "C"

    before = t_prompts.prompt(t"{a:a} {b:b}")
    after = t_prompts.prompt(t"{b:b} {c:c} {a:a}")

    diff = diff_structured_prompts(before, after)

    keyed = {child.key: child for child in diff.root.children if isinstance(child.key, str)}

    assert keyed["b"].movement is Movement.MOVED
    assert keyed["b"].change_type is NodeChange.REPLACE

    assert keyed["c"].change_type is NodeChange.INSERT
    assert diff.stats.insertions >= 1


def test_structured_diff_preserves_nested_structure():
    """Nested prompts should yield nested deltas for child keys."""

    value = "42"
    inner_before = t_prompts.prompt(t"Inner {value:value}")
    before = t_prompts.prompt(t"Wrap {inner_before:inner}")
    inner_after = t_prompts.prompt(t"Inner updated {value:value}")
    after = t_prompts.prompt(t"Wrap {inner_after:inner}!")

    diff = diff_structured_prompts(before, after)

    inner_delta = next(child for child in diff.root.children if child.key == "inner")
    assert inner_delta.change_type is NodeChange.REPLACE
    inner_static = _get_child_by_type(inner_delta, "Static")
    assert inner_static.text_diff is not None
    assert inner_static.text_diff.has_changes()


def test_render_diff_reports_chunk_operations():
    """Render diff should expose chunk operations and per-element summaries."""

    name = "Ada"
    before = t_prompts.prompt(t"Hello {name:name}")
    after = t_prompts.prompt(t"Hello dear {name:name}!\n")

    diff = diff_rendered_prompts(before, after)

    ops = [delta.op for delta in diff.operations]
    assert "replace" in ops or "insert" in ops
    assert any(
        delta.op == "replace" and delta.after and delta.after.text.startswith("Hello dear")
        for delta in diff.operations
    )

    # Element summaries should aggregate per element text lengths
    assert diff.element_summaries
    name_id = after["name"].id
    if name_id not in diff.element_summaries:
        name_id = before["name"].id
    name_summary = diff.element_summaries[name_id]
    assert name_summary.operations["replace"] >= 1


def test_prompt_diff_repr_html_contains_expected_markup():
    """The HTML representation should expose the root container and node classes."""

    foo = "foo"
    before = t_prompts.prompt(t"{foo:foo}")
    after = t_prompts.prompt(t"changed {foo:foo}")

    diff = diff_structured_prompts(before, after)
    html = diff._repr_html_()

    assert "tp-diff" in html
    assert "tp-diff-node" in html
    assert "tp-diff-chip" in html


def test_render_diff_repr_html_contains_table_markup():
    """Render diff HTML should include a table of chunk operations."""

    before = t_prompts.prompt(t"alpha")
    after = t_prompts.prompt(t"alpha beta")

    diff = diff_rendered_prompts(before, after)
    html = diff._repr_html_()

    assert "tp-render-diff" in html
    assert "<table" in html
    assert "tp-render-diff-row" in html
