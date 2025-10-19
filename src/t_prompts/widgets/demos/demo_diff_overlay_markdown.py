"""Show diff overlay highlighting markdown and rendered changes."""

from t_prompts import dedent, diff_rendered_prompts, diff_structured_prompts, prompt
from t_prompts.widgets import PromptDiffOverlay, run_preview


def create_report_prompt_before():
    """A simple daily report template."""

    return dedent(
        t"""
        # Daily Standup

        ## Yesterday
        - Wrapped the ingestion pipeline
        - Completed retry logic for the worker

        ## Today
        - Start validating the analytics export

        ## Blockers
        - Waiting on credentials for the staging bucket
        """
    )


def create_report_prompt_after():
    """Updated template with additional context and formatting."""

    notes = [
        prompt(t"Reminder: keep items to bullet fragments."),
        prompt(t"If blocked, include the expected unblock date."),
    ]

    return dedent(
        t"""
        # Daily Standup

        :::info
        {notes:notes}
        :::

        ## Yesterday
        - Finalized ingestion pipeline
        - Added retry logic for worker (now with jitter)

        ## Today
        - Validate analytics export in staging
        - Draft QA checklist for release

        ## Blockers
        - Waiting on staging bucket credentials (ETA tomorrow)
        - Release checklist template from compliance
        """
    )


def create_markdown_diff_demo():
    """Build a PromptDiffOverlay focusing on markdown-rendered edits."""

    before = create_report_prompt_before()
    after = create_report_prompt_after()

    structured = diff_structured_prompts(before, after)
    rendered = diff_rendered_prompts(before, after)

    return PromptDiffOverlay(after=after, before=before, structured_diff=structured, rendered_diff=rendered)


if __name__ == "__main__":
    run_preview(__file__, create_markdown_diff_demo)
