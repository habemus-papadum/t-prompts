"""Demo 04: Quantum Chemistry Computational Workflow (Advanced)

This demo composes a rich technical document that:
- Highlights clean composition through reusable helper prompts
- Walks through a complete Morse potential vibration analysis
- Demonstrates advanced markdown (tables, math, images, blockquotes, etc.)

Run with:
    python -m t_prompts.widgets.demos.04_demo

Or use in a notebook:
    from t_prompts.widgets.demos.04_demo import create_quantum_workflow_demo
    create_quantum_workflow_demo()
"""

from collections.abc import Callable
from pathlib import Path
from typing import Any

from t_prompts import dedent, prompt
from t_prompts.widgets import run_preview


def code_block(language: str, code_prompt: Any):
    """Wrap content in a fenced markdown code block."""
    return dedent(
        t"""
        ```{language}
        {code_prompt:code_content}
        ```
        """
    )


def latex_block(equation_prompt: Any):
    """Wrap LaTeX content in display math delimiters."""
    return dedent(
        t"""
        $$
        {equation_prompt:equation_content}
        $$
        """
    )


def section(title: str, content: Any):
    """Create a markdown section that automatically manages header depth."""
    return dedent(
        t"""
        {content:{title}:header={title}}
        """
    )


def parameters_table(params: dict[str, str]):
    """Generate a markdown table from a mapping of parameter names to values."""
    header = "| Parameter | Value |"
    separator = "|-----------|-------|"
    rows = [f"| {name} | {value} |" for name, value in params.items()]
    table_text = "\n".join([header, separator, *rows])
    return prompt(t"{table_text:parameter_table_text}")


def note_box(message: str, icon: str = "ℹ️"):
    """Render an emphasized blockquote note with an optional icon."""
    return dedent(t"> {icon} **Note:** {message}")


def build_morse_potential(D_e: str, a: str, r_e: str) -> Callable[[], Any]:
    """Return a factory that builds the Morse potential prompt."""

    def _build():
        return dedent(
            t"""
            def morse_potential(
                r,
                D_e={D_e:dissociation_energy},
                a={a:width_parameter},
                r_e={r_e:equilibrium_distance},
            ):
                return D_e * (1 - np.exp(-a * (r - r_e)))**2
            """
        )

    return _build


def build_solver_program(
    potential_name: str,
    potential_def,
    grid_points: str,
    r_min: str,
    r_max: str,
):
    prelude = dedent(
        t"""
        # Quantum Morse Oscillator Solver
        # Solves the time-independent Schrödinger equation with a Morse potential

        import numpy as np
        from scipy import linalg

        """
    )

    scaffolding = dedent(
        t"""
        N_POINTS = {grid_points:number_of_points}
        R_MIN = {r_min:grid_minimum}
        R_MAX = {r_max:grid_maximum}
        REDUCED_MASS = 0.50391  # atomic units (H2 reduced mass as an example)


        def construct_grid():
            \"\"\"Create radial grid for the finite-difference discretization.\"\"\"
            return np.linspace(R_MIN, R_MAX, N_POINTS)


        def setup_hamiltonian(r_grid):
            \"\"\"Assemble the Hamiltonian matrix for the vibrational problem.\"\"\"
            dr = r_grid[1] - r_grid[0]
            kinetic = construct_kinetic_matrix(N_POINTS, dr, REDUCED_MASS)
            potential = np.diag({potential_name}(r_grid))
            return kinetic + potential


        def solve_spectrum(r_grid):
            \"\"\"Diagonalize the Hamiltonian and return energies and wavefunctions.\"\"\"
            hamiltonian = setup_hamiltonian(r_grid)
            eigenvalues, eigenvectors = diagonalize(hamiltonian)
            normalized = normalize_wavefunctions(eigenvectors, r_grid)
            return eigenvalues, normalized


        def main():
            \"\"\"Driver routine: build grid, solve, and report key energy levels.\"\"\"
            grid = construct_grid()
            energies, wavefunctions = solve_spectrum(grid)
            labels = ["ground", "first", "second"]
            for label, energy in zip(labels, energies[:3]):
                print(f"{{label.title():>6}} state → {{energy:.5f}} eV")
            return energies, wavefunctions


        if __name__ == "__main__":
            main()
        """
    )

    """Compose a full solver program with interpolated building blocks."""
    return dedent(
        t"""
        {prelude}

        {potential_def:potential_definition}
        {scaffolding:solver_scaffolding}

        """
    )


def create_quantum_workflow_demo():
    """Compose the full Morse potential vibrational workflow demo."""

    # Level 1 interpolation: primitive parameters
    D_e = "4.5"  # eV
    a = "1.9"  # Å⁻¹
    r_e = "0.74"  # Å

    # Level 3: Build potential function prompt (factory for reuse)
    morse_function_factory = build_morse_potential(D_e, a, r_e)
    morse_function_for_solver = morse_function_factory()

    # Level 4: Combine function into solver skeleton
    solver_program = build_solver_program(
        potential_name="morse_potential",
        potential_def=morse_function_for_solver,
        grid_points="500",
        r_min="0.30",
        r_max="3.00",
    )

    # Level 5: Wrap solver in a code fence
    solver_code_block = code_block("python", solver_program)

    # -------------------------------------------------------------------------
    # Section 1: Overview
    # -------------------------------------------------------------------------

    overview_content = dedent(
        t"""
        Welcome to an ***end-to-end computational workflow*** for studying **anharmonic molecular vibrations**
        with the *Morse potential*.

        > “Precision in quantum chemistry emerges when theory, computation, and interpretation move in harmony.”
        """
    )
    overview_section = section("Overview", overview_content)

    solver_configuration_table = parameters_table(
        {
            "Discretization": "Finite-difference second order",
            "Grid points": "500 nodes across 0.30–3.00 Å",
            "Boundary handling": "Dirichlet (wavefunction → 0 at edges)",
            "Diagonalization": "Helper `diagonalize()` routine (SciPy backend)",
        }
    )

    morse_equation = latex_block(
        prompt(
            t"""
            V(r) = D_e \\left(1 - e^{{-a (r - r_e)}}\\right)^2
            """
        )
    )

    implementation_section = section(
        "Implementation",
        dedent(
            t"""
            We assemble the solver from reusable building blocks, each captured by a prompt-friendly helper.

            {solver_configuration_table:solver_configuration_table}

            {morse_equation:morse_equation}

            {solver_code_block:solver_code_block}
            """
        ),
    )

    # -------------------------------------------------------------------------
    # Section 5: Visualization & Results
    # -------------------------------------------------------------------------
    from PIL import Image

    image_path = Path(__file__).parent.parent.parent.parent.parent / "docs" / "assets" / "warps-and-wefts.png"
    visualization_image = Image.open(image_path)
    visualization_image = visualization_image.resize((300, 300))

    visualization_intro = dedent(
        t"""
        {visualization_image:wave_visual}
        """
    )

    energy_comparison_table = dedent(
        t"""
        | Level | Analytical (eV) | Numerical (eV) |
        |-------|------------------|-----------------|
        | ν = 0 | 0.1180           | 0.1183          |
        | ν = 1 | 0.3435           | 0.3439          |
        | ν = 2 | 0.5552           | 0.5558          |
        """
    )

    visualization_section = section(
        "Visualization & Results",
        dedent(
            t"""
            {visualization_intro:visualization_intro}

            ### Computational Results

            {energy_comparison_table:energy_comparison_table}

            """
        ),
    )

    # -------------------------------------------------------------------------
    # Compose Final Document
    # -------------------------------------------------------------------------
    return dedent(
        t"""
        {overview_section:overview_section}

        {implementation_section:implementation_section}

        {visualization_section:visualization_section}
        """
    )


def create_quantum_workflow_prompt():
    """Alias retained for backward compatibility with earlier demos."""
    return create_quantum_workflow_demo()


if __name__ == "__main__":
    run_preview(__file__, create_quantum_workflow_demo)
