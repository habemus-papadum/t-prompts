"""Demo: RenderedPromptDiff - Text-Level Changes Visualization

This demo shows how RenderedPromptDiff visualizes text-level changes between
two rendered versions of a prompt, highlighting character-level insertions,
deletions, and replacements in the final output.

Run with:
    python -m t_prompts.widgets.demos.demo_rendered_diff

Or use in a notebook:
    from t_prompts.widgets.demos.demo_rendered_diff import create_rendered_diff_demo
    create_rendered_diff_demo()
"""

from t_prompts import dedent, prompt, diff_rendered_prompts
from t_prompts.widgets import run_preview


def create_code_review_before():
    """Create the 'before' version - initial code review."""
    pr_number = "1234"
    author = "alice"
    status = "pending"

    changes_summary = dedent(t"""
        - Added user authentication
        - Updated database schema
        - Fixed bug in payment processing
        """)

    reviewer_notes = dedent(t"""
        The implementation looks good overall. Please address the following:

        1. Add unit tests for the auth module
        2. Update the API documentation
        3. Consider edge cases for payment validation
        """)

    return dedent(t"""
        # Code Review for PR #{pr_number:pr_number}

        **Author**: {author:author}
        **Status**: {status:status}

        ## Changes Summary
        {changes_summary:changes}

        ## Reviewer Notes
        {reviewer_notes:notes}

        ## Next Steps
        Please update and request re-review.
        """)


def create_code_review_after():
    """Create the 'after' version - updated code review after changes."""
    pr_number = "1234"
    author = "alice"
    status = "approved"  # Changed

    # Modified with additional item
    changes_summary = dedent(t"""
        - Added user authentication with JWT tokens
        - Updated database schema with migration script
        - Fixed bug in payment processing for edge cases
        - Added comprehensive unit test coverage
        """)

    # Significantly modified
    reviewer_notes = dedent(t"""
        Excellent work! All requested changes have been addressed:

        1. ✓ Added unit tests for the auth module with 95% coverage
        2. ✓ Updated the API documentation with examples
        3. ✓ Implemented edge case handling for payment validation

        The code is now production-ready. Great attention to detail!
        """)

    return dedent(t"""
        # Code Review for PR #{pr_number:pr_number}

        **Author**: {author:author}
        **Status**: {status:status}

        ## Changes Summary
        {changes_summary:changes}

        ## Reviewer Notes
        {reviewer_notes:notes}

        ## Next Steps
        Ready to merge! Great work on addressing all feedback.
        """)


def create_rendered_diff_demo():
    """Create a RenderedPromptDiff comparing two code review versions."""
    before = create_code_review_before()
    after = create_code_review_after()

    return diff_rendered_prompts(before, after)


if __name__ == "__main__":
    run_preview(__file__, create_rendered_diff_demo)
