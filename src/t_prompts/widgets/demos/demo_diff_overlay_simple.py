"""Demo: Diff Overlay - Simple Text Modifications

This demo shows how the diff overlay feature integrates into the standard
Structured Prompt widget, highlighting text-level changes between two versions.

Run with:
    python -m t_prompts.widgets.demos.demo_diff_overlay_simple

Or use in a notebook:
    from t_prompts.widgets.demos.demo_diff_overlay_simple import create_diff_overlay_demo
    create_diff_overlay_demo()
"""

from t_prompts import dedent
from t_prompts.widgets import run_preview


def create_email_draft_before():
    """Create the 'before' version - initial email draft."""
    recipient = "team@example.com"
    subject = "Project Update"

    greeting = "Hi team,"

    body = dedent(t"""
        I wanted to give you a quick update on the project progress.

        We've completed the initial design phase and are moving into development.
        The timeline looks good and we're on track for the deadline.
        """)

    closing = "Best regards,\nAlice"

    return dedent(t"""
        To: {recipient:to}
        Subject: {subject:subj}

        {greeting:greeting}

        {body:body}

        {closing:closing}
        """)


def create_email_draft_after():
    """Create the 'after' version - revised email draft with updates."""
    recipient = "team@example.com"
    subject = "Project Update - Week 3"  # Changed: More specific subject

    greeting = "Hi team,"

    # Modified: Added more details and changed some text
    body = dedent(t"""
        I wanted to give you an update on our project progress for this week.

        We've successfully completed the initial design phase and are now moving into
        active development. The timeline looks excellent and we're ahead of schedule!

        Next week, we'll focus on implementing the core features.
        """)

    closing = "Best regards,\nAlice"

    return dedent(t"""
        To: {recipient:to}
        Subject: {subject:subj}

        {greeting:greeting}

        {body:body}

        {closing:closing}
        """)


def create_diff_overlay_demo():
    """Create a diff overlay widget comparing two email versions."""
    before = create_email_draft_before()
    after = create_email_draft_after()

    # Use the new widget_with_diff method to create an enhanced widget
    return after.widget_with_diff(before)


if __name__ == "__main__":
    run_preview(__file__, create_diff_overlay_demo)
