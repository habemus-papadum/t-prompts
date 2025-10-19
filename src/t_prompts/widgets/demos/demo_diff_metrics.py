"""Interactive diff metrics demo for structured vs rendered comparisons."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Callable

from t_prompts import dedent, diff_rendered_prompts, diff_structured_prompts, prompt
from t_prompts.widgets import js_prelude, run_preview
from t_prompts.widgets.widget import Widget


@dataclass
class Scenario:
    """Container for demo scenario metadata and prompt builders."""

    label: str
    description: str
    build: Callable[[], tuple]


def _micro_tweak() -> tuple:
    meeting = "roadmap sync"
    before = prompt(t"Reminder: {meeting:meeting}\n")
    after = prompt(t"Reminder: {meeting:meeting}!\n")
    return before, after


def _copy_refresh() -> tuple:
    title_before = prompt(t"## Release notes\n")
    bullets_before = [prompt(t"- Added new endpoint\n"), prompt(t"- Updated docs\n")]
    before = dedent(t"""
        {title_before:title}
        Highlights:\n{bullets_before:list}
        """)

    title_after = prompt(t"## Release notes (v2)\n")
    bullets_after = [
        prompt(t"- Added authenticated endpoint with RBAC\n"),
        prompt(t"- Updated docs with onboarding flow\n"),
        prompt(t"- Improved telemetry defaults\n"),
    ]
    after = dedent(t"""
        {title_after:title}
        Highlights:\n{bullets_after:list}
        """)

    return before, after


def _major_restructure() -> tuple:
    intro = prompt(t"# Incident report\n")
    summary = prompt(t"Impact limited to EU region.\n")
    timeline = [
        prompt(t"- 09:03 Alert triggered\n"),
        prompt(t"- 09:20 Mitigation applied\n"),
        prompt(t"- 09:45 Issue resolved\n"),
    ]
    before = dedent(t"""
        {intro:intro}
        Summary:\n{summary:summary}
        Timeline:\n{timeline:list}
        """)

    intro_after = prompt(t"# Incident report — payment API outage\n")
    summary_after = prompt(t"Checkout API unavailable for 42 minutes in EU and APAC.\n")
    timeline_after = [
        prompt(t"- 09:03 Alert triggered (EU latency spike)\n"),
        prompt(t"- 09:12 APAC impacted\n"),
        prompt(t"- 09:20 Mitigation applied\n"),
        prompt(t"- 09:45 Issue resolved\n"),
        prompt(t"- 10:05 Postmortem assigned\n"),
    ]
    lessons = [
        prompt(t"- Add regional failover test cases\n"),
        prompt(t"- Automate rollback verification\n"),
    ]
    after = dedent(t"""
        {intro_after:intro}
        Summary:\n{summary_after:summary}
        Timeline:\n{timeline_after:list}
        Follow-up:\n{lessons:list}
        """)

    return before, after


SCENARIOS = {
    "micro": Scenario(
        label="Micro tweak",
        description="Punctuation-only change for a short reminder prompt.",
        build=_micro_tweak,
    ),
    "copy": Scenario(
        label="Copy refresh",
        description="Expanded release notes with additional bullet points.",
        build=_copy_refresh,
    ),
    "restructure": Scenario(
        label="Major restructure",
        description="Incident report rewritten with new sections and reordered items.",
        build=_major_restructure,
    ),
}


def create_diff_metrics_demo() -> Widget:
    """Create an interactive diff demo with scenario selector and mode toggle."""

    payload: dict[str, dict[str, object]] = {}
    for key, scenario in SCENARIOS.items():
        before, after = scenario.build()
        structured = diff_structured_prompts(before, after).to_widget_data()
        rendered = diff_rendered_prompts(before, after).to_widget_data()
        payload[key] = {
            "label": scenario.label,
            "description": scenario.description,
            "structured": structured,
            "rendered": rendered,
        }

    scenario_json = json.dumps(payload)

    html = f"""
    <div class="tp-diff-demo" id="tp-diff-metrics-demo">
      {js_prelude()}
      <style>
        #tp-diff-metrics-demo {{
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          line-height: 1.5;
        }}
        #tp-diff-metrics-demo .tp-controls {{
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          align-items: center;
          margin-bottom: 1rem;
        }}
        #tp-diff-metrics-demo label {{
          display: flex;
          flex-direction: column;
          font-size: 0.85rem;
          gap: 0.25rem;
        }}
        #tp-diff-metrics-demo select,
        #tp-diff-metrics-demo input[type="checkbox"] {{
          font-size: 1rem;
        }}
        #tp-diff-metrics-demo .tp-description {{
          margin-bottom: 1rem;
          color: #444;
        }}
      </style>
      <div class="tp-controls">
        <label>
          Scenario
          <select id="tp-diff-scenario">
            {''.join(f'<option value="{key}">{data["label"]}</option>' for key, data in payload.items())}
          </select>
        </label>
        <label style="flex-direction: row; align-items: center; gap: 0.5rem;">
          <input type="checkbox" id="tp-diff-mode" />
          Rendered diff
        </label>
      </div>
      <div class="tp-description" id="tp-diff-description"></div>
      <div id="tp-diff-widget"></div>
    </div>
    <script>
      (function() {{
        const scenarios = {scenario_json};
        const select = document.getElementById('tp-diff-scenario');
        const toggle = document.getElementById('tp-diff-mode');
        const description = document.getElementById('tp-diff-description');
        const mount = document.getElementById('tp-diff-widget');

        function render() {{
          if (!select || !toggle || !mount || !description) {{
            return;
          }}

          const scenario = scenarios[select.value];
          if (!scenario) {{
            return;
          }}

          description.textContent = scenario.description || '';

          const mode = toggle.checked ? 'rendered' : 'structured';
          const data = scenario[mode];
          mount.innerHTML = '';

          const container = document.createElement('div');
          container.className = 'tp-widget-root';

          const scriptTag = document.createElement('script');
          scriptTag.type = 'application/json';
          scriptTag.dataset.role = 'tp-widget-data';
          scriptTag.textContent = JSON.stringify(data);

          const mountPoint = document.createElement('div');
          mountPoint.className = mode === 'rendered' ? 'tp-rendered-diff-mount' : 'tp-sp-diff-mount';

          container.appendChild(scriptTag);
          container.appendChild(mountPoint);
          mount.appendChild(container);

          const runtime = window.__TPWidget || window.tpWidget;
          if (runtime && typeof runtime.initWidget === 'function') {{
            runtime.initWidget(container);
          }}
        }}

        select?.addEventListener('change', render);
        toggle?.addEventListener('change', render);
        render();
      }})();
    </script>
    """

    return Widget(html)


if __name__ == "__main__":
    run_preview(__file__, create_diff_metrics_demo)
