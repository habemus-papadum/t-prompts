"""Demo: StructuredPromptDiff - Major Project Restructure

This demo shows how StructuredPromptDiff visualizes structural changes in a
major project overhaul, demonstrating size metrics for significant restructuring.

Run with:
    python -m t_prompts.widgets.demos.demo_structured_diff_size_metrics

Or use in a notebook:
    from t_prompts.widgets.demos.demo_structured_diff_size_metrics import create_structured_diff_size_metrics_demo
    create_structured_diff_size_metrics_demo()
"""

from t_prompts import dedent, diff_structured_prompts, prompt
from t_prompts.widgets import run_preview


def create_project_atlas_before():
    """Create the 'before' version - initial Project Atlas proposal."""
    summary = prompt(
        t"""
        **Project Atlas** unifies reporting pipelines and replaces
        the legacy cron scheduler.
        """
    )
    return dedent(
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


def create_project_atlas_after():
    """Create the 'after' version - restructured Project Atlas brief."""
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
    return dedent(
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


def create_structured_diff_size_metrics_demo():
    """Create a StructuredPromptDiff showing a major project restructure."""
    before = create_project_atlas_before()
    after = create_project_atlas_after()

    return diff_structured_prompts(before, after)


if __name__ == "__main__":
    run_preview(__file__, create_structured_diff_size_metrics_demo)
