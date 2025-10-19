"""Demo: Diff Overlay - Complex Structural Changes

This demo shows how the diff overlay feature handles complex structural changes
including additions, deletions, and reorganization of nested prompt elements.

Run with:
    python -m t_prompts.widgets.demos.demo_diff_overlay_complex

Or use in a notebook:
    from t_prompts.widgets.demos.demo_diff_overlay_complex import create_complex_diff_overlay_demo
    create_complex_diff_overlay_demo()
"""

from t_prompts import dedent, prompt
from t_prompts.widgets import run_preview


def create_api_spec_before():
    """Create the 'before' version - initial API specification."""
    endpoint = "/api/users"
    method = "GET"
    version = "v1"

    description = dedent(t"""
        Retrieves a list of users from the system.
        """)

    auth = dedent(t"""
        ### Authentication
        Bearer token required in the Authorization header.
        """)

    params = [
        prompt(t"- `limit` (optional): Maximum number of results"),
        prompt(t"- `offset` (optional): Number of results to skip"),
    ]

    response_example = dedent(t"""
        ```json
        {{
          "users": [
            {{"id": 1, "name": "Alice"}},
            {{"id": 2, "name": "Bob"}}
          ]
        }}
        ```
        """)

    return dedent(t"""
        # API Specification

        ## {endpoint:endpoint} ({method:method})

        **Version:** {version:version}

        {description:desc}

        {auth:auth}

        ### Query Parameters
        {params:params}

        ### Response Format
        Returns a JSON array of user objects.

        #### Example Response
        {response_example:example}
        """)


def create_api_spec_after():
    """Create the 'after' version - updated API specification with major changes."""
    endpoint = "/api/v2/users"  # Changed: versioned endpoint
    method = "GET"
    version = "v2"  # Changed: version bump

    # Modified: more detailed description
    description = dedent(t"""
        Retrieves a paginated list of user records from the system database.
        Supports filtering, sorting, and field selection.
        """)

    # Modified: expanded auth options
    auth = dedent(t"""
        ### Authentication
        Supports Bearer token or API key authentication.

        - **Bearer Token:** Include in Authorization header
        - **API Key:** Include as `X-API-Key` header
        """)

    # Modified: changed parameters
    params = [
        prompt(t"- `limit` (optional): Maximum results per page (default: 20, max: 100)"),
        prompt(t"- `page` (optional): Page number for pagination (default: 1)"),
        prompt(t"- `sort` (optional): Sort field (options: name, created_at, email)"),
        prompt(t"- `fields` (optional): Comma-separated list of fields to include"),
    ]

    # New section: Error handling
    error_handling = dedent(t"""
        ### Error Responses

        | Status Code | Description |
        |-------------|-------------|
        | 400 | Invalid query parameters |
        | 401 | Authentication failed |
        | 403 | Insufficient permissions |
        | 429 | Rate limit exceeded |
        """)

    # Modified: more detailed response example
    response_example = dedent(t"""
        ```json
        {{
          "data": [
            {{
              "id": 1,
              "name": "Alice Johnson",
              "email": "alice@example.com",
              "created_at": "2024-01-15T10:30:00Z"
            }},
            {{
              "id": 2,
              "name": "Bob Smith",
              "email": "bob@example.com",
              "created_at": "2024-01-16T14:20:00Z"
            }}
          ],
          "pagination": {{
            "page": 1,
            "limit": 20,
            "total": 2,
            "total_pages": 1
          }}
        }}
        ```
        """)

    # New section: Rate limiting
    rate_limiting = dedent(t"""
        ### Rate Limiting
        This endpoint is rate-limited to 100 requests per minute per API key.
        Rate limit information is included in response headers.
        """)

    return dedent(t"""
        # API Specification

        ## {endpoint:endpoint} ({method:method})

        **Version:** {version:version}

        {description:desc}

        {auth:auth}

        ### Query Parameters
        {params:params}

        {error_handling:errors}

        {rate_limiting:rate_limit}

        ### Response Format
        Returns a paginated JSON object containing user records.

        #### Example Response
        {response_example:example}
        """)


def create_complex_diff_overlay_demo():
    """Create a diff overlay widget comparing two API specification versions."""
    before = create_api_spec_before()
    after = create_api_spec_after()

    # Use the new widget_with_diff method to create an enhanced widget
    return after.widget_with_diff(before)


if __name__ == "__main__":
    run_preview(__file__, create_complex_diff_overlay_demo)
