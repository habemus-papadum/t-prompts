"""Demonstrate the unified widget with diff overlays for structural changes.

Run with:
    python -m t_prompts.widgets.demos.demo_structured_prompt_diff_overlay

Or within a notebook:
    from t_prompts.widgets.demos.demo_structured_prompt_diff_overlay import create_structured_prompt_diff_overlay
    create_structured_prompt_diff_overlay()
"""

from t_prompts import dedent, prompt
from t_prompts.widgets import build_diff_overlay_widget, run_preview


def create_structured_prompt_diff_overlay():
    """Create a pair of prompts that highlight tree and chunk diff overlays."""

    milestones_before = [
        prompt(t"""Create staging build"""),
        prompt(t"""Run regression suite"""),
    ]
    milestones_after = [
        prompt(t"""Create staging build"""),
        prompt(t"""Run regression suite"""),
        prompt(t"""Publish release notes"""),
    ]

    qa_steps = prompt(
        t"""
        Verify smoke tests in staging.
        Coordinate with QA for exploratory passes.
        """
    )

    pilot_feedback = prompt(
        t"""
        Collect survey responses from design partner cohort.
        Summarize top issues and regression risks.
        """
    )

    stability = "Crash free sessions >= 99.8%"
    performance = "p95 response time <= 250ms"

    milestones = milestones_before
    before_prompt = dedent(
        t"""
        ## Release plan

        1. {milestones:milestones}
        2. Coordinate rollout with stakeholders
        3. Capture risks and mitigations

        ### Metrics
        - Stability gate: {stability:stability}
        - Performance gate: {performance:performance}
        """
    )

    milestones = milestones_after
    qa = qa_steps
    pilot = pilot_feedback
    after_prompt = dedent(
        t"""
        ## Release plan

        1. {milestones:milestones}
        2. Communicate rollout to support and marketing teams
        3. {qa:qa}

        ### Metrics
        - Stability gate: {stability:stability}
        - Performance gate: {performance:performance}
        - Customer pilot feedback: {pilot:pilot}
        """
    )

    return build_diff_overlay_widget(
        after_prompt,
        before=before_prompt,
    )


if __name__ == "__main__":
    run_preview(__file__, create_structured_prompt_diff_overlay)
