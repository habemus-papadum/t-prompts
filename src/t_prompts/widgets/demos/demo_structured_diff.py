"""Demo: StructuredPromptDiff - Structural Changes Visualization

This demo shows how StructuredPromptDiff visualizes structural changes between
two versions of a prompt, highlighting additions, deletions, and modifications
in the prompt tree structure.

Run with:
    python -m t_prompts.widgets.demos.demo_structured_diff

Or use in a notebook:
    from t_prompts.widgets.demos.demo_structured_diff import create_structured_diff_demo
    create_structured_diff_demo()
"""

from t_prompts import dedent, diff_structured_prompts, prompt
from t_prompts.widgets import run_preview


def create_api_documentation_before():
    """Create the 'before' version - initial API documentation."""
    endpoint = "/api/users"
    method = "GET"

    auth_section = dedent(t"""
        **Authentication**: Bearer token required
        """)

    params = [
        prompt(t"- `limit` (optional): Maximum results"),
        prompt(t"- `offset` (optional): Pagination offset"),
    ]

    return dedent(t"""
        # API Endpoint Documentation

        ## {endpoint:endpoint}

        **Method**: {method:method}

        {auth_section:authentication}

        ### Query Parameters
        {params:parameters}

        ### Response Format
        Returns a JSON array of user objects.
        """)


def create_api_documentation_after():
    """Create the 'after' version - updated API documentation."""
    endpoint = "/api/v2/users"  # Changed: version added
    method = "GET"

    # Modified: Added API key option
    auth_section = dedent(t"""
        **Authentication**: Bearer token or API key required
        """)

    # Modified: Added new parameter, removed offset
    params = [
        prompt(t"- `limit` (optional): Maximum results (default: 20)"),  # Modified
        prompt(t"- `page` (optional): Page number for pagination"),  # New
        prompt(t"- `sort` (optional): Sort field (name, created_at)"),  # New
    ]

    # New section
    error_handling = dedent(t"""
        ### Error Handling

        - `400`: Invalid parameters
        - `401`: Authentication failed
        - `429`: Rate limit exceeded
        """)

    return dedent(t"""
        # API Endpoint Documentation

        ## {endpoint:endpoint}

        **Method**: {method:method}

        {auth_section:authentication}

        ### Query Parameters
        {params:parameters}

        {error_handling:errors}

        ### Response Format
        Returns a paginated JSON object with user data.
        """)


def create_structured_diff_demo():
    """Create a StructuredPromptDiff comparing two API documentation versions."""
    before = create_api_documentation_before()
    after = create_api_documentation_after()

    return diff_structured_prompts(before, after)


if __name__ == "__main__":
    run_preview(__file__, create_structured_diff_demo)
