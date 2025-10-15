#!/usr/bin/env python3
"""Release automation script for t-prompts.

This script automates the release process:
1. Verifies git repo is clean
2. Validates version has -alpha suffix
3. Calculates release version (strips -alpha)
4. Runs all validation (tests, notebooks, linting, docs, widgets build/lint/test)
5. Updates version files to release version
6. Updates uv.lock with new version
7. Creates release commit and tag
8. Pushes tag to origin
9. Publishes to PyPI
10. Creates GitHub release (triggers docs deployment)
11. Bumps to next development version with -alpha
12. Updates uv.lock with new dev version
13. Commits and pushes development version
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path


# File paths
REPO_ROOT = Path(__file__).parent
PYPROJECT_TOML = REPO_ROOT / "pyproject.toml"
INIT_PY = REPO_ROOT / "src" / "t_prompts" / "__init__.py"


def print_step(message: str) -> None:
    """Print a step message with formatting."""
    print(f"\n{'='*70}")
    print(f"  {message}")
    print(f"{'='*70}\n")


def run_command(cmd: list[str], description: str, capture_output: bool = False) -> subprocess.CompletedProcess:
    """Run a command and check for errors.

    Args:
        cmd: Command and arguments as list
        description: Human-readable description of what the command does
        capture_output: Whether to capture stdout/stderr

    Returns:
        CompletedProcess instance

    Raises:
        SystemExit: If command fails
    """
    print(f"→ {description}")
    print(f"  Command: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            cwd=REPO_ROOT,
            capture_output=capture_output,
            text=True,
            check=True
        )
        if not capture_output:
            print(f"✓ {description} completed successfully")
        return result
    except subprocess.CalledProcessError as e:
        print(f"\n✗ ERROR: {description} failed!")
        if capture_output:
            if e.stdout:
                print(f"stdout: {e.stdout}")
            if e.stderr:
                print(f"stderr: {e.stderr}")
        sys.exit(1)


def check_git_clean() -> None:
    """Verify that the git repository has no uncommitted changes."""
    print_step("Checking Git Repository Status")

    result = run_command(
        ["git", "status", "--porcelain"],
        "Checking for uncommitted changes",
        capture_output=True
    )

    if result.stdout.strip():
        print("✗ ERROR: Git repository is not clean!")
        print("\nUncommitted changes:")
        print(result.stdout)
        sys.exit(1)

    print("✓ Git repository is clean")


def read_version_from_file(file_path: Path, pattern: str) -> str:
    """Read version from a file using a regex pattern.

    Args:
        file_path: Path to file
        pattern: Regex pattern with three groups (prefix, version, suffix)

    Returns:
        Version string (group 2)

    Raises:
        SystemExit: If version not found
    """
    content = file_path.read_text()
    match = re.search(pattern, content, flags=re.MULTILINE)

    if not match:
        print(f"✗ ERROR: Could not find version in {file_path}")
        sys.exit(1)

    return match.group(2)  # Return the second capture group (the version)


def write_version_to_file(file_path: Path, pattern: str, new_version: str) -> None:
    """Write new version to a file using a regex pattern.

    Args:
        file_path: Path to file
        pattern: Regex pattern with three groups (prefix, version, suffix)
        new_version: New version string to write (replaces group 2)
    """
    content = file_path.read_text()
    new_content = re.sub(pattern, rf'\g<1>{new_version}\g<3>', content, flags=re.MULTILINE)
    file_path.write_text(new_content)


def read_current_version() -> tuple[str, str]:
    """Read current version from pyproject.toml and __init__.py.

    Returns:
        Tuple of (pyproject_version, init_version)

    Raises:
        SystemExit: If versions don't match
    """
    print_step("Reading Current Version")

    # Read from pyproject.toml (use word boundary to match exactly "version = " not "target-version = ")
    pyproject_version = read_version_from_file(
        PYPROJECT_TOML,
        r'^(version = ")([^"]+)(")'
    )
    print(f"  pyproject.toml: {pyproject_version}")

    # Read from __init__.py
    init_version = read_version_from_file(
        INIT_PY,
        r'(__version__ = ")([^"]+)(")'
    )
    print(f"  __init__.py: {init_version}")

    # Verify they match
    if pyproject_version != init_version:
        print(f"\n✗ ERROR: Version mismatch!")
        print(f"  pyproject.toml: {pyproject_version}")
        print(f"  __init__.py: {init_version}")
        sys.exit(1)

    print(f"\n✓ Current version: {pyproject_version}")
    return pyproject_version, init_version


def validate_alpha_version(version: str) -> None:
    """Validate that version ends with -alpha.

    Args:
        version: Version string to validate

    Raises:
        SystemExit: If version doesn't end with -alpha
    """
    if not version.endswith("-alpha"):
        print(f"✗ ERROR: Version must end with -alpha to release")
        print(f"  Current version: {version}")
        print(f"  Expected format: X.Y.Z-alpha")
        sys.exit(1)

    print(f"✓ Version has -alpha suffix")


def strip_alpha(version: str) -> str:
    """Remove -alpha suffix from version.

    Args:
        version: Version string with -alpha suffix

    Returns:
        Version without -alpha
    """
    return version.replace("-alpha", "")


def bump_version(version: str, level: str) -> str:
    """Bump version according to level.

    Args:
        version: Current version (without -alpha)
        level: One of 'patch', 'minor', 'major'

    Returns:
        Next version string

    Raises:
        SystemExit: If version format is invalid
    """
    match = re.match(r'^(\d+)\.(\d+)\.(\d+)$', version)
    if not match:
        print(f"✗ ERROR: Invalid version format: {version}")
        sys.exit(1)

    major, minor, patch = map(int, match.groups())

    if level == "patch":
        patch += 1
    elif level == "minor":
        minor += 1
        patch = 0
    elif level == "major":
        major += 1
        minor = 0
        patch = 0
    else:
        print(f"✗ ERROR: Invalid bump level: {level}")
        sys.exit(1)

    return f"{major}.{minor}.{patch}"


def update_version_files(version: str) -> None:
    """Update version in both pyproject.toml and __init__.py.

    Args:
        version: New version string
    """
    write_version_to_file(
        PYPROJECT_TOML,
        r'^(version = ")([^"]+)(")',
        version
    )
    write_version_to_file(
        INIT_PY,
        r'(__version__ = ")([^"]+)(")',
        version
    )
    print(f"✓ Updated version to {version} in both files")


def update_lockfile() -> None:
    """Update uv.lock to reflect version changes in pyproject.toml."""
    print_step("Updating Lockfile")
    run_command(
        ["uv", "lock"],
        "Updating uv.lock with new version"
    )


def run_tests() -> None:
    """Run unit tests."""
    print_step("Running Unit Tests")
    run_command(
        ["uv", "run", "pytest"],
        "Running pytest"
    )


def run_notebook_tests(no_inplace: bool = False) -> None:
    """Run notebook tests.

    Args:
        no_inplace: If True, run notebooks without modifying files (for validation).
    """
    print_step("Running Notebook Tests")
    cmd = ["./test_notebooks.sh"]
    if no_inplace:
        cmd.append("--no-inplace")
    run_command(
        cmd,
        "Running notebook tests" + (" (read-only mode)" if no_inplace else "")
    )


def run_linting() -> None:
    """Run linting checks."""
    print_step("Running Linting Checks")
    run_command(
        ["uv", "run", "ruff", "check", "."],
        "Running ruff linting"
    )


def build_docs() -> None:
    """Build documentation with mkdocs."""
    print_step("Building Documentation")
    run_command(
        ["uv", "run", "mkdocs", "build"],
        "Building mkdocs site"
    )


def build_widgets() -> None:
    """Build JavaScript widgets and verify no uncommitted changes."""
    print_step("Building JavaScript Widgets")

    # Build widgets
    run_command(
        ["pnpm", "build"],
        "Building widgets with pnpm"
    )

    # Check for uncommitted changes in widgets/dist
    result = run_command(
        ["git", "status", "--porcelain", "widgets/dist"],
        "Checking for widget build changes",
        capture_output=True
    )

    if result.stdout.strip():
        print("✗ ERROR: Widget build produced uncommitted changes!")
        print("\nChanges in widgets/dist:")
        print(result.stdout)
        print("\nPlease run 'pnpm build' and commit the changes before releasing.")
        sys.exit(1)

    print("✓ Widget build is up-to-date")


def run_widget_linting() -> None:
    """Run widget linting checks with pnpm."""
    print_step("Running Widget Linting Checks")
    run_command(
        ["pnpm", "lint"],
        "Running pnpm lint"
    )


def run_widget_tests() -> None:
    """Run widget unit tests with pnpm."""
    print_step("Running Widget Unit Tests")
    run_command(
        ["pnpm", "test"],
        "Running pnpm test"
    )


def create_release_commit(version: str) -> None:
    """Create a git commit for the release.

    Args:
        version: Release version string
    """
    print_step(f"Creating Release Commit: {version}")

    run_command(
        ["git", "add", str(PYPROJECT_TOML), str(INIT_PY), "uv.lock"],
        "Staging version files and lockfile"
    )

    run_command(
        ["git", "commit", "-m", version],
        f"Committing release {version}"
    )


def create_release_tag(version: str) -> None:
    """Create an annotated git tag for the release.

    Args:
        version: Release version string
    """
    tag_name = f"v{version}"
    print_step(f"Creating Release Tag: {tag_name}")

    run_command(
        ["git", "tag", "-a", tag_name, "-m", version],
        f"Creating tag {tag_name}"
    )


def push_tag(version: str) -> None:
    """Push the release tag to origin.

    Args:
        version: Release version string
    """
    tag_name = f"v{version}"
    print_step(f"Pushing Tag to Origin: {tag_name}")

    run_command(
        ["git", "push", "origin", tag_name],
        f"Pushing tag {tag_name}"
    )


def publish_to_pypi() -> None:
    """Publish the package to PyPI using the publish script."""
    print_step("Publishing to PyPI")

    run_command(
        ["./publish.sh"],
        "Running publish.sh to build and publish to PyPI"
    )


def create_github_release(version: str) -> None:
    """Create a GitHub release for the version tag.

    Args:
        version: Release version string
    """
    tag_name = f"v{version}"
    print_step(f"Creating GitHub Release: {tag_name}")

    run_command(
        ["gh", "release", "create", tag_name, "--title", version, "--generate-notes"],
        f"Creating GitHub release {tag_name}"
    )


def create_dev_commit(version: str) -> None:
    """Create a git commit for the development version.

    Args:
        version: Development version string
    """
    print_step(f"Creating Development Version Commit: {version}")

    run_command(
        ["git", "add", str(PYPROJECT_TOML), str(INIT_PY), "uv.lock"],
        "Staging version files and lockfile"
    )

    run_command(
        ["git", "commit", "-m", f"Bump to {version}"],
        f"Committing development version {version}"
    )


def push_dev_commit() -> None:
    """Push the development version commit to origin."""
    print_step("Pushing Development Commit to Origin")

    # Get current branch name
    result = run_command(
        ["git", "branch", "--show-current"],
        "Getting current branch name",
        capture_output=True
    )
    branch = result.stdout.strip()

    run_command(
        ["git", "push", "origin", branch],
        f"Pushing to origin/{branch}"
    )


def main() -> None:
    """Main release workflow."""
    # Parse arguments
    parser = argparse.ArgumentParser(
        description="Automate the release process for t-prompts"
    )
    parser.add_argument(
        "bump_level",
        choices=["patch", "minor", "major"],
        help="Version bump level for next development version"
    )
    args = parser.parse_args()

    print("\n" + "="*70)
    print("  t-prompts Release Script")
    print("="*70)
    print(f"\nBump level: {args.bump_level}")

    # Confirmation prompt
    print("\n" + "!"*70)
    print("  WARNING: This script will perform a RELEASE")
    print("!"*70)
    print("\nThis script will:")
    print("  • Run all validation checks (tests, notebooks, linting, docs, widgets)")
    print("  • Create and push a release commit and tag")
    print("  • Publish the package to PyPI")
    print("  • Create a GitHub release (triggering docs deployment)")
    print("  • Bump to the next development version")
    print("\nThis is a SERIOUS operation that affects production!")
    print("\nType 'acknowledge' to continue or Ctrl+C to cancel: ", end="", flush=True)

    confirmation = input().strip()
    if confirmation != "acknowledge":
        print("\n✗ Release cancelled. You must type 'acknowledge' to proceed.")
        sys.exit(1)

    print("✓ Proceeding with release...")

    # Step 1: Check git status
    check_git_clean()

    # Step 2: Read current version
    current_version, _ = read_current_version()

    # Step 3: Validate has -alpha
    validate_alpha_version(current_version)

    # Step 4: Calculate release version (but don't update files yet)
    release_version = strip_alpha(current_version)
    print_step(f"Preparing Release: {release_version}")
    print(f"  Release version: {release_version}")

    # Step 5-11: Run all validation checks BEFORE modifying version
    run_tests()
    run_notebook_tests(no_inplace=True)
    run_linting()
    build_docs()
    build_widgets()
    run_widget_linting()
    run_widget_tests()

    # Step 12: Update version files for release
    update_version_files(release_version)

    # Step 13: Update lockfile with new version
    update_lockfile()

    # Step 14: Create release commit
    create_release_commit(release_version)

    # Step 15: Create release tag
    create_release_tag(release_version)

    # Step 16: Push tag to origin
    push_tag(release_version)

    # Step 17: Publish to PyPI
    publish_to_pypi()

    # Step 18: Create GitHub release
    create_github_release(release_version)

    # Step 19: Calculate next development version
    next_version = bump_version(release_version, args.bump_level)
    next_dev_version = f"{next_version}-alpha"

    print_step(f"Preparing Next Development Version: {next_dev_version}")
    print(f"  Next development version: {next_dev_version}")

    # Step 20: Update to next development version
    update_version_files(next_dev_version)

    # Step 21: Update lockfile with new dev version
    update_lockfile()

    # Step 22: Create development commit
    create_dev_commit(next_dev_version)

    # Step 23: Push development commit
    push_dev_commit()

    # Success!
    print_step("Release Complete!")
    print(f"✓ Released: {release_version}")
    print(f"✓ Tagged and pushed: v{release_version}")
    print(f"✓ Published to PyPI: {release_version}")
    print(f"✓ Created GitHub release: v{release_version}")
    print(f"✓ Next development version: {next_dev_version}")
    print("\nThe GitHub release will trigger documentation deployment to GitHub Pages.")


if __name__ == "__main__":
    main()
