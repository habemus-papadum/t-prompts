"""Demonstrate the structured prompt widget with diff overlay enabled."""

from t_prompts import dedent, diff_rendered_prompts, diff_structured_prompts, prompt
from t_prompts.widgets import PromptDiffOverlay, run_preview


def create_before_prompt():
    """Original onboarding email prompt."""

    intro = "Welcome to Nimbus AI!"
    tone = "enthusiastic"

    bullet_points = [
        prompt(t"- 24/7 support from specialists"),
        prompt(t"- Access to curated automation recipes"),
        prompt(t"- Weekly office hours with our team"),
    ]

    return dedent(
        t"""
        # {intro:intro}

        ## Tone
        {tone:tone}

        ## Highlights
        {bullet_points:highlights}

        ## Call to Action
        Encourage the reader to schedule a kickoff call.
        """
    )


def create_after_prompt():
    """Revised prompt with additional sections and updated copy."""

    intro = "Welcome to Nimbus AI, your automation co-pilot!"
    tone = "friendly and confident"
    testimonial = "Working with Nimbus trimmed our launch time by 40%. — A. Lee"

    bullet_points = [
        prompt(t"- Hands-on automation playbooks for marketing and ops"),
        prompt(t"- Dedicated success manager for your first 90 days"),
        prompt(t"- Weekly community workshops and teardown sessions"),
    ]

    faq = [
        prompt(t"**What do I need to get started?** A single pilot workflow."),
        prompt(t"**How long does setup take?** Under two focused afternoons."),
    ]

    return dedent(
        t"""
        # {intro:intro}

        > {testimonial:testimonial}

        ## Tone
        {tone:tone}

        ## Highlights
        {bullet_points:highlights}

        ## Getting Started
        Outline the single next step, then invite questions in a friendly tone.

        ## FAQ
        {faq:faq}
        """
    )


def create_diff_overlay_demo():
    """Create a PromptDiffOverlay for the revised onboarding email."""

    before = create_before_prompt()
    after = create_after_prompt()

    structured = diff_structured_prompts(before, after)
    rendered = diff_rendered_prompts(before, after)

    return PromptDiffOverlay(after=after, before=before, structured_diff=structured, rendered_diff=rendered)


if __name__ == "__main__":
    run_preview(__file__, create_diff_overlay_demo)
