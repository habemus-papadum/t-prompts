"""Release notes demo for the structured prompt diff overlay widget.

Run with:
    python -m t_prompts.widgets.demos.demo_prompt_diff_overlay_release_notes

Or use in a notebook:
    from t_prompts.widgets.demos.demo_prompt_diff_overlay_release_notes import create_release_notes_diff_demo
    create_release_notes_diff_demo()
"""

from t_prompts import dedent, diff_rendered_prompts, diff_structured_prompts
from t_prompts.widgets import run_preview


def create_release_notes_before():
    """Original release notes with terse copy."""

    version = "2.4"
    new_feature = "collaborative editing"

    return dedent(
        t"""
        # Release notes {version:version}

        ## Highlights
        - Added {new_feature:new_feature}
        - Improved dashboard charts
        - Bug fixes and stability updates

        ## Details
        Collaborative editing lets teams work together on templates. Charts load faster.
        """
    )


def create_release_notes_after():
    """Expanded release notes with context and guidance."""

    version = "2.4"
    new_feature = "collaborative editing"

    return dedent(
        t"""
        # Release notes {version:version}

        ## Highlights
        - {new_feature:new_feature} with real-time cursors
        - Dashboard charts now render 2x faster
        - Squashed 17 bugs reported by the community

        ## Why it matters
        • Teams can co-author prompts in a shared workspace without overwriting each other.
        • Dashboards stay responsive even for large datasets.

        ## Getting started
        1. Invite teammates from the workspace menu.
        2. Open any template to see collaborators joining in real time.
        3. Enable "Performance mode" in settings to try the new chart renderer.
        """
    )


def create_release_notes_diff_demo():
    """Render the release notes with diff overlays enabled."""

    before = create_release_notes_before()
    after = create_release_notes_after()

    structured = diff_structured_prompts(before, after)
    rendered = diff_rendered_prompts(before, after)

    prior_ir = before.ir()
    compiled = after.ir().compile()

    return compiled.widget(prior_ir=prior_ir, structured_diff=structured, rendered_diff=rendered)


if __name__ == "__main__":
    run_preview(__file__, create_release_notes_diff_demo)
