"""Demo: StructuredPrompt diff overlay for incident response updates.

This demo pairs the unified Structured Prompt widget with diff overlays to
illustrate how operational playbooks evolve between incidents. The before
prompt represents an older emergency response runbook, while the after version
introduces improved coordination steps, richer communications guidance, and
new retrospective requirements.

Run with:
    python -m t_prompts.widgets.demos.demo_structured_prompt_diff_overlay_incident

Or within a notebook:
    from t_prompts.widgets.demos.demo_structured_prompt_diff_overlay_incident import (
        create_incident_response_overlay,
    )
    create_incident_response_overlay()
"""

from t_prompts import dedent, prompt
from t_prompts.widgets import build_diff_overlay_widget, run_preview


def create_incident_response_overlay():
    """Create prompts that highlight structural and rendered diff overlays."""

    detection_before = prompt(
        t"""
        - Validate alert payload in PagerDuty.
        - Confirm incident severity with the on-call engineer.
        - Gather latest telemetry snapshots from the observability dashboard.
        """
    )

    detection_after = prompt(
        t"""
        - Validate alert payload in PagerDuty.
        - Confirm incident severity with the on-call engineer.
        - Capture automated evidence: logs, traces, screenshots.
        - File provisional status in the incident tracker.
        """
    )

    communications_before = prompt(
        t"""
        - Notify #incident channel.
        - Page the secondary responder if the primary does not acknowledge.
        - Send executive summary after mitigation.
        """
    )

    communications_after = prompt(
        t"""
        - Notify #incident channel with timeline link and active assignee.
        - Spin up Zoom bridge and pin the URL in channel topic.
        - Page communications lead for customer updates.
        - Publish executive summary and mitigation ETA to status page.
        """
    )

    timeline_before = prompt(
        t"""
        ### Immediate actions
        - Stabilize impacted services.
        - Document key mitigation steps in the shared doc.

        ### Within 24 hours
        - Collect contributing factors from responders.
        - Schedule a postmortem review if impact exceeds SLA.
        """
    )

    timeline_after = prompt(
        t"""
        ### Immediate actions
        - Stabilize impacted services.
        - Document key mitigation steps in the shared doc.
        - Post mitigation timeline in the incident tracker.

        ### Within 24 hours
        - Collect contributing factors from responders.
        - Schedule a postmortem review if impact exceeds SLA.
        - Assign owners for follow-up tasks with due dates.

        ### Within 72 hours
        - Publish customer-facing summary with remediation status.
        - Capture learnings in the operations handbook.
        """
    )

    detection = detection_before
    communications = communications_before
    timeline = timeline_before
    before_prompt = dedent(
        t"""
        # Incident response runbook

        ## Detection checklist
        {detection:detection}

        ## Communications guidance
        {communications:communications}

        ## Timeline
        {timeline:timeline}
        """
    )

    detection = detection_after
    communications = communications_after
    timeline = timeline_after
    after_prompt = dedent(
        t"""
        # Incident response runbook

        ## Detection checklist
        {detection:detection}

        ## Communications guidance
        {communications:communications}

        ## Timeline
        {timeline:timeline}

        ## Post-incident
        - Capture primary root cause in the tracker.
        - Share a 5-minute retrospective video clip.
        - Archive relevant graphs and notes.
        """
    )

    return build_diff_overlay_widget(after_prompt, before=before_prompt)


if __name__ == "__main__":
    run_preview(__file__, create_incident_response_overlay)
