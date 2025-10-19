"""Demo: StructuredPrompt diff overlay for a product brief refresh.

The before prompt captures an early launch brief for a feature. The after prompt
expands the narrative with updated user stories, removes obsolete guardrails,
and introduces new review checkpoints. This scenario exercises tree badges,
ghost nodes, and Markdown diff overlays in the unified widget.

Run with:
    python -m t_prompts.widgets.demos.demo_structured_prompt_diff_overlay_product_brief

Or within a notebook:
    from t_prompts.widgets.demos.demo_structured_prompt_diff_overlay_product_brief import (
        create_product_brief_overlay,
    )
    create_product_brief_overlay()
"""

from t_prompts import dedent, prompt
from t_prompts.widgets import build_diff_overlay_widget, run_preview


def create_product_brief_overlay():
    """Construct prompts showcasing product brief diffs."""

    summary_before = prompt(
        t"""
        Launch a focused experiment that helps workspace admins preview
        upcoming automation capabilities without enabling them for everyone.
        """
    )

    summary_after = prompt(
        t"""
        Launch a cohort-based experiment that introduces automation previews
        to admins and power users while guarding production stability.
        """
    )

    user_stories_before = prompt(
        t"""
        - As an admin, I can see example automation templates.
        - As an admin, I can enable the automation sandbox.
        - As an admin, I can roll back to manual workflows.
        """
    )

    user_stories_after = prompt(
        t"""
        - As an admin, I can see curated automation templates with success metrics.
        - As an admin, I can invite power users to co-create sandbox runs.
        - As a power user, I can capture run history and annotate learnings.
        - As a support agent, I can review escalations triggered by automations.
        """
    )

    rollout_before = prompt(
        t"""
        ### Launch checklist
        - Complete security review.
        - Update release playbook.
        - Train customer support team.
        """
    )

    rollout_after = prompt(
        t"""
        ### Launch checklist
        - Complete security review.
        - Update release playbook.
        - Publish self-serve migration FAQ.
        - Align go-to-market messaging with product marketing.

        ### Experiment checkpoints
        - Weekly instrumentation review with analytics.
        - Bi-weekly design critique on automation templates.
        """
    )

    risks_before = prompt(
        t"""
        - Automation failures break core workflows.
        - Admins are confused about preview scope.
        """
    )

    risk_mitigations_after = prompt(
        t"""
        - Automation failures break core workflows.
        - Admins are confused about preview scope.
        - Preview cohort leaks outside allow list.

        ### Mitigations
        - Add real-time kill switch with telemetry integration.
        - Ship onboarding tour clarifying preview limitations.
        - Gate invites behind feature flags with expiry.
        """
    )

    summary = summary_before
    user_stories = user_stories_before
    rollout = rollout_before
    risks = risks_before
    before_prompt = dedent(
        t"""
        # Automation preview launch brief

        ## Summary
        {summary:summary}

        ## User stories
        {user_stories:user_stories}

        ## Rollout
        {rollout:rollout}

        ## Risks
        {risks:risks}

        ## Approvals
        - Product
        - Engineering
        - Support
        """
    )

    summary = summary_after
    user_stories = user_stories_after
    rollout = rollout_after
    risks = risk_mitigations_after
    after_prompt = dedent(
        t"""
        # Automation preview launch brief

        ## Summary
        {summary:summary}

        ## User stories
        {user_stories:user_stories}

        ## Rollout
        {rollout:rollout}

        ## Risks & mitigations
        {risks:risks}

        ## Approvals
        - Product
        - Engineering
        - Support operations
        - Privacy review
        """
    )

    return build_diff_overlay_widget(after_prompt, before=before_prompt)


if __name__ == "__main__":
    run_preview(__file__, create_product_brief_overlay)
