"""Tests for diff utilities."""

from __future__ import annotations

import json

import pytest

from t_prompts import diff_rendered_prompts, diff_structured_prompts, prompt


def test_structured_prompt_diff_detects_text_changes():
    """Leaf edits should surface in stats and node deltas."""

    task = "translate"
    before = prompt(t"Task: {task:t}")
    after = prompt(t"Task: {task:t}!\n")

    diff = diff_structured_prompts(before, after)

    assert diff.stats.text_added > 0
    assert diff.stats.nodes_modified >= 1
    assert diff.metrics.struct_span_chars >= diff.stats.text_added
    assert diff.metrics.struct_edit_count >= 0.5

    static = next(
        (child for child in diff.root.children if child.element_type.startswith("Static") and child.status != "equal"),
        None,
    )
    assert static is not None
    assert static.status == "modified"
    assert any(edit.op in {"insert", "replace"} for edit in static.text_edits)

    html = diff._repr_html_()
    assert "tp-sp-diff-mount" in html
    assert "data-tp-widget" in html
    assert '"diff_type": "structured"' in html


def test_structured_prompt_diff_detects_structure_changes():
    """Inserted nodes should be identified with appropriate status values."""

    intro = prompt(t"Overview")
    before = prompt(t"Intro: {intro:i}\n")

    intro = prompt(t"Overview")
    details = prompt(t"Details section")
    after = prompt(t"Intro: {intro:i}\nDetails: {details:d}\n")

    diff = diff_structured_prompts(before, after)

    assert diff.stats.nodes_added >= 1
    statuses = {child.status for child in diff.root.children}
    assert "inserted" in statuses or "modified" in statuses
    assert diff.metrics.struct_edit_count >= 1


def test_structured_prompt_diff_handles_nested_prompts_and_lists():
    """Changes within nested prompts and list items are tracked."""

    intro = prompt(t"Overview")
    items = [prompt(t"- Step one"), prompt(t"- Step two")]
    before = prompt(t"Intro: {intro:i}\nItems:\n{items:list}\n")

    intro = prompt(t"Overview")
    items_updated = [prompt(t"- Step one"), prompt(t"- Step two"), prompt(t"- Bonus step")]
    after = prompt(t"Intro: {intro:i}\nItems:\n{items_updated:list}\n")

    diff = diff_structured_prompts(before, after)

    assert diff.stats.nodes_added >= 1
    assert any(node.status in {"inserted", "modified"} for node in diff.root.children)


def test_rendered_diff_tracks_chunk_operations():
    """Rendered diff should count chunk-level insertions and replacements."""

    name = "Ada"
    before = prompt(t"Hello {name:user}\n")
    after = prompt(t"Hello there {name:user}!\n")

    diff = diff_rendered_prompts(before, after)

    stats = diff.stats()
    assert stats["insert"] >= 1 or stats["replace"] >= 1
    assert diff.per_element
    assert diff.metrics.render_token_delta >= diff.metrics.render_non_ws_delta

    html = diff._repr_html_()
    assert "tp-rendered-diff-mount" in html
    assert "data-tp-widget" in html
    assert '"diff_type": "rendered"' in html


def test_diff_objects_are_json_serializable_roundtrip():
    """Stats payloads can be serialized for downstream analytics."""

    value = "alpha"
    before = prompt(t"Value: {value:v}")
    after = prompt(t"Value: {value:v}!\n")

    structured = diff_structured_prompts(before, after)
    rendered = diff_rendered_prompts(before, after)

    from dataclasses import asdict

    payload = {
        "structured": {
            "stats": asdict(structured.stats),
            "metrics": asdict(structured.metrics),
        },
        "rendered": {
            "metrics": asdict(rendered.metrics),
            "per_element": {k: asdict(v) for k, v in rendered.per_element.items()},
        },
    }
    json.dumps(payload)


def _case_simple_same():
    before = prompt(t"Simple text")
    after = prompt(t"Simple text")
    return before, after


def _case_prepend_newline():
    value = "x"
    before = prompt(t"Prelude {value:v}")
    value = "x"
    after = prompt(t"Prelude {value:v}\n")
    return before, after


def _case_nested_change():
    nested = prompt(t"Inner block")
    before = prompt(t"Header {nested:n}")
    nested = prompt(t"Inner block")
    after = prompt(t"Header {nested:n}!")
    return before, after


@pytest.mark.parametrize(
    "builder",
    [_case_simple_same, _case_prepend_newline, _case_nested_change],
)
def test_structured_prompt_diff_handles_various_sizes(builder):
    """Smoke test prompts of different complexity levels."""

    before, after = builder()

    diff = diff_structured_prompts(before, after)
    assert diff.root is not None
    assert isinstance(diff.stats.nodes_added, int)
    assert diff.metrics.struct_edit_count >= 0


def test_rendered_diff_widget_data_matches_operations():
    """Rendered diff widget payload should preserve chunk operations and text."""

    item1 = prompt(t"- one\n")
    item2 = prompt(t"- two\n")
    items_before = [item1, item2]
    before = prompt(t"Header\n{items_before:list}\n")

    item1_updated = prompt(t"- one\n")
    item3 = prompt(t"- three\n")
    items_after = [item1_updated, item3]
    after = prompt(t"Header\n{items_after:list}\nTail\n")

    diff = diff_rendered_prompts(before, after)
    widget_data = diff.to_widget_data()

    assert widget_data["diff_type"] == "rendered"
    ops = [delta["op"] for delta in widget_data["chunk_deltas"]]
    assert ops.count("insert") == 1
    assert ops.count("replace") == 1
    assert ops.count("equal") >= 1
    assert "metrics" in widget_data
    assert widget_data["metrics"]["render_token_delta"] >= widget_data["metrics"]["render_non_ws_delta"]

    tail_insert = next(delta for delta in widget_data["chunk_deltas"] if delta["op"] == "insert")
    assert tail_insert["before"] is None
    assert tail_insert["after"]["text"].strip().startswith("Tail")

    replace_delta = next(delta for delta in widget_data["chunk_deltas"] if delta["op"] == "replace")
    assert replace_delta["before"]["text"].strip() == "- two"
    assert replace_delta["after"]["text"].strip() == "- three"

    assert widget_data["stats"] == diff.stats()


def test_structured_diff_widget_data_serializes_text_edits_and_attr_changes():
    """Structured diff widget payload keeps None keys and listifies attr changes."""

    value = "alpha"
    before = prompt(t"Value: {value!r}")
    value = "alpha"
    after = prompt(t"Value: {value!s}!\n")

    diff = diff_structured_prompts(before, after)
    widget_data = diff.to_widget_data()

    assert widget_data["diff_type"] == "structured"
    assert widget_data["root"]["key"] is None

    interpolation = next(
        child for child in widget_data["root"]["children"] if child["element_type"] == "TextInterpolation"
    )
    assert interpolation["attr_changes"]["conversion"] == ["r", "s"]

    static_nodes = [child for child in widget_data["root"]["children"] if child["element_type"] == "Static"]
    assert any(edit["op"] == "insert" for node in static_nodes for edit in node["text_edits"])
    assert widget_data["metrics"]["struct_span_chars"] >= 0

    for node in widget_data["root"]["children"]:
        for change in node["attr_changes"].values():
            assert isinstance(change, list)
