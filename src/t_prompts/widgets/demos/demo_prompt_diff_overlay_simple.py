"""Simple demo showcasing the structured prompt diff overlay widget.

Run with:
    python -m t_prompts.widgets.demos.demo_prompt_diff_overlay_simple

Or use in a notebook:
    from t_prompts.widgets.demos.demo_prompt_diff_overlay_simple import create_prompt_diff_overlay_demo
    create_prompt_diff_overlay_demo()
"""

from t_prompts import dedent, diff_rendered_prompts, diff_structured_prompts
from t_prompts.widgets import run_preview


def create_before_prompt():
    """Create the baseline onboarding email."""

    audience = "new subscribers"
    product = "Acme Pro"
    benefit = "track goals and progress in real time"

    return dedent(
        t"""
        # Welcome email

        Hello {audience:audience},

        We're excited to introduce {product:product} so your team can {benefit:benefit}.

        • Schedule weekly check-ins
        • Share quick updates
        • Celebrate milestones together

        Ready to get started? Reply to this message and we'll activate your account.
        """
    )


def create_after_prompt():
    """Create a refined onboarding email with stronger messaging."""

    audience = "new subscribers"
    product = "Acme Pro"
    benefit = "track goals and progress in real time"

    return dedent(
        t"""
        # Welcome email

        Hello {audience:audience},

        Great news—{product:product} now helps your team {benefit:benefit}.

        What you can do this week:

        • Schedule focused weekly check-ins
        • Share quick wins and blockers in one place
        • Celebrate team milestones with automatic summaries

        Ready to dive in? Activate your workspace with one click below.
        """
    )


def create_prompt_diff_overlay_demo():
    """Render the structured prompt widget with diff overlays enabled."""

    before = create_before_prompt()
    after = create_after_prompt()

    structured = diff_structured_prompts(before, after)
    rendered = diff_rendered_prompts(before, after)

    prior_ir = before.ir()
    compiled = after.ir().compile()

    return compiled.widget(prior_ir=prior_ir, structured_diff=structured, rendered_diff=rendered)


if __name__ == "__main__":
    run_preview(__file__, create_prompt_diff_overlay_demo)
