"""Demo that surfaces diff size metrics with interactive controls."""

from __future__ import annotations

import uuid
from typing import Callable, Sequence

from t_prompts import dedent, diff_rendered_prompts, diff_structured_prompts, prompt
from t_prompts.structured_prompt import StructuredPrompt
from t_prompts.widgets import run_preview
from t_prompts.widgets.widget import Widget

ScenarioBuilder = Callable[[], tuple[StructuredPrompt, StructuredPrompt]]


def _scenario_copy_tweak() -> tuple[StructuredPrompt, StructuredPrompt]:
    """Lightweight edit touching copy only."""

    intro = prompt(t"Welcome to the weekly briefing.")
    before = dedent(
        t"""
        # Weekly Briefing

        {intro:intro}

        ## Agenda
        - Market recap
        - Engineering updates
        - Hiring snapshot
        """
    )

    intro = prompt(t"Welcome to the weekly briefing.")
    closing = prompt(t"Questions? Reach out to ops@company.example.")
    after = dedent(
        t"""
        # Weekly Briefing

        {intro:intro} Please review the action items below.

        ## Agenda
        - Market recap
        - Engineering updates
        - Hiring snapshot

        ## Next Steps
        {closing:closing}
        """
    )

    return before, after


def _scenario_list_growth() -> tuple[StructuredPrompt, StructuredPrompt]:
    """Moderate churn that extends a procedure."""

    steps = [
        prompt(t"1. Capture requirements"),
        prompt(t"2. Draft implementation plan"),
        prompt(t"3. Review with stakeholders"),
    ]
    before = dedent(
        t"""
        ## Launch Runbook

        ### Deployment Steps
        {steps:list}

        ### Validation
        - Smoke tests
        - KPI checks
        """
    )

    steps = [
        prompt(t"1. Capture requirements"),
        prompt(t"2. Draft implementation plan"),
        prompt(t"3. Review with stakeholders"),
        prompt(t"4. Execute canary release"),
        prompt(t"5. Monitor error budgets"),
    ]
    validation = [prompt(t"- Smoke tests"), prompt(t"- KPI checks"), prompt(t"- Customer support sign-off")]
    after = dedent(
        t"""
        ## Launch Runbook

        ### Deployment Steps
        {steps:list}

        ### Validation
        {validation:list}

        ### Rollback Plan
        - Revert feature flag
        - Announce status in #launches
        """
    )

    return before, after


def _scenario_major_overhaul() -> tuple[StructuredPrompt, StructuredPrompt]:
    """Significant restructure merging content blocks."""

    summary = prompt(
        t"""
        **Project Atlas** unifies reporting pipelines and replaces
        the legacy cron scheduler.
        """
    )
    before = dedent(
        t"""
        # Project Atlas Proposal

        ## Overview
        {summary:summary}

        ## Milestones
        - Phase 1: Data ingestion
        - Phase 2: Transformation layer
        - Phase 3: Dashboard rollout

        ## Risks
        - Migration overlap with Beta launch
        - Lack of observability for cron jobs
        """
    )

    summary = prompt(
        t"""
        **Project Atlas** unifies reporting pipelines,
        introduces real-time dashboards, and retires the cron stack.
        """
    )
    deliverables = [
        prompt(t"1. Unified ingestion API"),
        prompt(t"2. Stream processing jobs"),
        prompt(t"3. Observability dashboards"),
        prompt(t"4. Playbooks for on-call teams"),
    ]
    after = dedent(
        t"""
        # Project Atlas Brief

        ## Executive Summary
        {summary:summary}

        ## Deliverables
        {deliverables:list}

        ## Timeline
        - Q1: Foundations complete
        - Q2: Pilot teams onboarded
        - Q3: Company-wide rollout

        ## Risk Mitigations
        - Pair migration with on-call playbooks
        - Allocate dedicated observability sprint
        """
    )

    return before, after


_SCENARIOS: Sequence[tuple[str, str, ScenarioBuilder]] = [
    ("copy", "Minor copy tweak", _scenario_copy_tweak),
    ("list", "Expanded checklist", _scenario_list_growth),
    ("major", "Major restructure", _scenario_major_overhaul),
]


def create_diff_size_metrics_demo() -> Widget:
    """Build demo widget with scenario selector and diff mode toggle."""

    mount_id = f"tp-diff-size-{uuid.uuid4().hex}"
    option_html: list[str] = []
    panel_html: list[str] = []

    for scenario_id, label, builder in _SCENARIOS:
        before, after = builder()
        structured_diff = diff_structured_prompts(before, after)
        rendered_diff = diff_rendered_prompts(before, after)

        option_html.append(f'<option value="{scenario_id}">{label}</option>')
        panel_html.append(
            """
<div class="tp-demo-diff-panel" data-role="diff-panel" data-mode="structured" data-scenario="{scenario}">
{html}
</div>
""".format(
                scenario=scenario_id,
                html=structured_diff._repr_html_(),
            )
        )
        panel_html.append(
            """
<div class="tp-demo-diff-panel" data-role="diff-panel" data-mode="rendered" data-scenario="{scenario}" hidden>
{html}
</div>
""".format(
                scenario=scenario_id,
                html=rendered_diff._repr_html_(),
            )
        )

    controls = """
<div class="tp-demo-controls">
  <label>
    Scenario
    <select data-role="scenario-select">
      {options}
    </select>
  </label>
  <label class="tp-demo-toggle">
    <input type="checkbox" data-role="mode-toggle" />
    <span data-role="mode-label">Structured diff</span>
  </label>
</div>
""".format(options="\n      ".join(option_html))

    container = """
<div class="tp-demo-diff-size" id="{mount}">
  {controls}
  <div class="tp-demo-diff-container">
    {panels}
  </div>
</div>
<script>
(function() {{
  const root = document.getElementById('{mount}');
  if (!root) {{
    return;
  }}
  const select = root.querySelector('[data-role="scenario-select"]');
  const toggle = root.querySelector('[data-role="mode-toggle"]');
  const label = root.querySelector('[data-role="mode-label"]');
  const panels = root.querySelectorAll('[data-role="diff-panel"]');

  function update() {{
    if (!select || !toggle) {{
      return;
    }}
    const scenario = select.value;
    const mode = toggle.checked ? 'rendered' : 'structured';

    panels.forEach((panel) => {{
      const matches =
        panel.getAttribute('data-scenario') === scenario &&
        panel.getAttribute('data-mode') === mode;
      panel.toggleAttribute('hidden', !matches);
    }});

    if (label) {{
      label.textContent = mode === 'rendered' ? 'Rendered diff' : 'Structured diff';
    }}
  }}

  if (select) {{
    select.addEventListener('change', update);
  }}
  if (toggle) {{
    toggle.addEventListener('change', update);
  }}

  update();
}})();
</script>
""".format(mount=mount_id, controls=controls, panels="\n    ".join(panel_html))

    return Widget(container)


if __name__ == "__main__":
    run_preview(__file__, create_diff_size_metrics_demo)
