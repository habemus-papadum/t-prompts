"""Demonstrate diff overlays with rich markdown content and inserted sections.

Run with:
    python -m t_prompts.widgets.demos.demo_structured_prompt_diff_overlay_markdown

Or in a notebook:
    from t_prompts.widgets.demos.demo_structured_prompt_diff_overlay_markdown import create_markdown_diff_overlay
    create_markdown_diff_overlay()
"""

from t_prompts import dedent, prompt
from t_prompts.widgets import build_diff_overlay_widget, run_preview


def create_markdown_diff_overlay():
    """Return a widget with markdown heavy diff overlays."""

    mitigation = prompt(
        t"""
        Mitigated by draining traffic to the secondary region and clearing
        the cache entries affected by the faulty deployment.
        """
    )

    analysis = prompt(
        t"""
        Identified configuration drift between regions and inconsistent
        feature flag rollout behaviour.
        """
    )

    tasks_before = [
        prompt(t"""Add automated alarm for cache error budget"""),
        prompt(t"""Document rollback procedure in runbook"""),
    ]

    tasks_after = tasks_before + [
        prompt(t"""Create regression test covering region divergence"""),
    ]

    communication = prompt(
        t"""
        Notify affected customers via status page update.
        Provide retrospective with mitigation steps within 24 hours.
        """
    )

    tasks = tasks_before
    before_prompt = dedent(
        t"""
        # Incident summary

        ## Timeline
        - 09:05: Detected elevated error rates.
        - 09:20: Rolled back to previous deployment.

        ## Impact
        - User requests returning HTTP 500.
        - {mitigation:mitigation}

        ## Follow-up tasks
        {tasks:tasks}
        """
    )

    tasks = tasks_after
    after_prompt = dedent(
        t"""
        # Incident summary

        ## Timeline
        - 09:05: Detected elevated error rates.
        - 09:20: Rolled back to previous deployment.
        - 09:45: {analysis:analysis}

        ## Impact
        - User requests returning HTTP 500.
        - {mitigation:mitigation}
        - Added queue backlog for async jobs.

        ## Follow-up tasks
        {tasks:tasks}

        ## Customer communication
        {communication:communication}
        """
    )

    return build_diff_overlay_widget(after_prompt, before=before_prompt)


if __name__ == "__main__":
    run_preview(__file__, create_markdown_diff_overlay)
