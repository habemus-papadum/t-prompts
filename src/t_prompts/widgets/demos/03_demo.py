"""Demo 03: Quantum Chemistry Computational Workflow

This demo showcases:
- Clean composition patterns with reusable helper functions
- Multi-level interpolation (parameters → functions → code → sections → document)
- Comprehensive markdown features (tables, code blocks, LaTeX, images, links, etc.)
- Realistic technical document structure

Run with:
    python -m t_prompts.widgets.demos.03_demo

Or use in a notebook:
    from t_prompts.widgets.demos.03_demo import create_quantum_workflow_demo
    create_quantum_workflow_demo()
"""

from pathlib import Path

from t_prompts import prompt
from t_prompts.widgets import run_preview


# =============================================================================
# Helper Functions - Reusable Composition Patterns
# =============================================================================


def code_block(language: str, code_content):
    """Wrap content in a fenced code block.

    Parameters
    ----------
    language : str
        Programming language for syntax highlighting
    code_content : StructuredPrompt or str
        The code to wrap

    Returns
    -------
    StructuredPrompt
        Code wrapped in markdown fenced code block
    """
    return prompt(t"```{language}\n{code_content:code}\n```")


def latex_block(equation_content):
    """Wrap LaTeX equation in display math delimiters.

    Parameters
    ----------
    equation_content : StructuredPrompt or str
        LaTeX equation content

    Returns
    -------
    StructuredPrompt
        LaTeX wrapped in $$ ... $$ delimiters
    """
    return prompt(t"$$\n{equation_content:eq}\n$$")


def section(title: str, content, level: int = 2):
    """Create a markdown section with header.

    Parameters
    ----------
    title : str
        Section title
    content : StructuredPrompt or str
        Section content
    level : int, optional
        Header level (2 = ##, 3 = ###, etc.), default 2

    Returns
    -------
    StructuredPrompt
        Formatted section with header and content
    """
    return prompt(t"{title:_:header}\n\n{content:content}\n\n")


def parameters_table(params: dict):
    """Generate a markdown table from parameter dictionary.

    Parameters
    ----------
    params : dict
        Dictionary of parameter names to values/descriptions

    Returns
    -------
    StructuredPrompt
        Markdown table with parameters
    """
    # Build table header
    header = "| Parameter | Value |"
    separator = "|-----------|-------|"

    # Build table rows
    rows = []
    for name, value in params.items():
        rows.append(f"| {name} | {value} |")

    table_content = "\n".join([header, separator] + rows)
    return prompt(t"{table_content}")


def note_box(message: str, icon: str = "ℹ️"):
    """Create an emphasized blockquote note.

    Parameters
    ----------
    message : str
        Note message
    icon : str, optional
        Emoji icon to prefix the note

    Returns
    -------
    StructuredPrompt
        Blockquote-formatted note
    """
    return prompt(t"> {icon} **Note:** {message}")


# =============================================================================
# Domain-Specific Builders
# =============================================================================


def build_morse_potential(D_e: str, a: str, r_e: str):
    """Build Morse potential function definition.

    Parameters
    ----------
    D_e : str
        Dissociation energy (eV)
    a : str
        Width parameter (Å⁻¹)
    r_e : str
        Equilibrium bond length (Å)

    Returns
    -------
    StructuredPrompt
        Python function definition for Morse potential
    """
    return prompt(
        t"""def morse_potential(r, D_e={D_e:De}, a={a:a_param}, r_e={r_e:re}):
    \"\"\"Morse potential energy function.

    V(r) = D_e * (1 - exp(-a*(r - r_e)))^2

    Parameters
    ----------
    r : array_like
        Internuclear distance
    D_e : float
        Dissociation energy (eV)
    a : float
        Width parameter (Å⁻¹)
    r_e : float
        Equilibrium bond length (Å)

    Returns
    -------
    array_like
        Potential energy at distance r
    \"\"\"
    return D_e * (1 - np.exp(-a * (r - r_e)))**2"""
    )


def build_solver_program(potential_name: str, potential_def, grid_points: str, r_min: str, r_max: str):
    """Build complete quantum solver program.

    Parameters
    ----------
    potential_name : str
        Name of the potential function
    potential_def : StructuredPrompt
        Potential function definition
    grid_points : str
        Number of grid points for discretization
    r_min : str
        Minimum r value
    r_max : str
        Maximum r value

    Returns
    -------
    StructuredPrompt
        Complete Python solver program
    """
    return prompt(
        t"""# Quantum Morse Oscillator Solver
# Solves the time-independent Schrödinger equation for the Morse potential

import numpy as np
from scipy import linalg

# Define the potential energy function
{potential_def:potential_func}

# Solver configuration
N_POINTS = {grid_points:npts}
R_MIN = {r_min:rmin}
R_MAX = {r_max:rmax}
MASS = 1.0  # Reduced mass in atomic units

def setup_hamiltonian(r_grid):
    \"\"\"Construct the Hamiltonian matrix on the grid.

    Uses finite difference for the kinetic energy operator
    and diagonal potential energy matrix.
    \"\"\"
    dr = r_grid[1] - r_grid[0]

    # Kinetic energy: -ℏ²/(2m) * d²/dr²
    # Using finite differences
    T = construct_kinetic_matrix(N_POINTS, dr, MASS)

    # Potential energy: diagonal matrix
    V = np.diag({potential_name}(r_grid))

    # Full Hamiltonian
    H = T + V
    return H

def solve_eigenvalue_problem(r_grid):
    \"\"\"Solve for energy eigenvalues and eigenfunctions.

    Returns
    -------
    energies : ndarray
        Energy eigenvalues (sorted)
    wavefunctions : ndarray
        Corresponding eigenfunctions (columns)
    \"\"\"
    H = setup_hamiltonian(r_grid)

    # Diagonalize Hamiltonian (helper function)
    eigenvalues, eigenvectors = diagonalize(H)

    # Normalize wavefunctions
    wavefunctions = normalize_wavefunctions(eigenvectors, r_grid)

    return eigenvalues, wavefunctions

# Run the solver
r_grid = np.linspace(R_MIN, R_MAX, N_POINTS)
energies, psi = solve_eigenvalue_problem(r_grid)

print(f"Ground state energy: {{energies[0]:.4f}} eV")
print(f"First excited state: {{energies[1]:.4f}} eV")
print(f"Second excited state: {{energies[2]:.4f}} eV")"""
    )


# =============================================================================
# Main Demo Builder
# =============================================================================


def create_quantum_workflow_demo():
    """Create a comprehensive quantum chemistry workflow demonstration.

    This function composes a complete technical document showcasing:
    - Theoretical background with LaTeX equations
    - Implementation with interpolated Python code
    - Data visualization with images
    - Results presentation with tables
    - External references with links

    Returns
    -------
    StructuredPrompt
        Complete workflow documentation
    """

    # -------------------------------------------------------------------------
    # Section 1: Overview
    # -------------------------------------------------------------------------

    overview_content = prompt(
        t"""This tutorial demonstrates a ***complete computational workflow*** for solving the **quantum mechanical** problem of molecular vibrations using the *Morse potential*.

The workflow includes:

1. **Theoretical foundation** - Schrödinger equation and Morse potential
2. **Numerical implementation** - Python solver with pluggable components
3. **Visualization** - Wavefunction and energy level diagrams
4. **Analysis** - Comparison with analytical predictions

---

> 💡 **Why the Morse Potential?**
> Unlike the harmonic oscillator, the Morse potential correctly describes bond dissociation and anharmonic effects observed in real molecules. It's particularly important for spectroscopy and chemical reaction dynamics."""
    )

    overview_section = section("Overview", overview_content, level=2)

    # -------------------------------------------------------------------------
    # Section 2: Theoretical Background
    # -------------------------------------------------------------------------

    # Schrödinger equation
    schrodinger_eq = latex_block(
        prompt(t"\\hat{{H}} \\psi(r) = E \\psi(r)")
    )

    schrodinger_content = prompt(
        t"""The time-independent Schrödinger equation governs the quantum states of our system:

{schrodinger_eq:eq1}

where `Ĥ` is the Hamiltonian operator, `ψ(r)` is the wavefunction, and `E` is the energy eigenvalue."""
    )

    schrodinger_subsection = section("The Schrödinger Equation", schrodinger_content, level=3)

    # Morse potential parameters
    D_e = "4.75"   # eV - typical for H₂
    a = "1.95"     # Å⁻¹
    r_e = "0.74"   # Å

    morse_eq = latex_block(
        prompt(
            t"""V(r) = D_e \\left(1 - e^{{-a(r - r_e)}}\\right)^2"""
        )
    )

    morse_params_table = parameters_table(
        {
            "`D_e`": f"{D_e} eV (dissociation energy)",
            "`a`": f"{a} Å⁻¹ (width parameter)",
            "`r_e`": f"{r_e} Å (equilibrium bond length)",
            "Molecule": "Hydrogen (H₂) typical values",
        }
    )

    morse_note = note_box(
        "The Morse potential reduces to the harmonic oscillator near equilibrium but correctly describes dissociation at large distances.",
        icon="⚛️"
    )

    morse_content = prompt(
        t"""The Morse potential is an analytical model for the interaction between two atoms:

{morse_eq:morse_equation}

**Physical Parameters:**

{morse_params_table:params}

{morse_note:note}"""
    )

    morse_subsection = section("Morse Potential", morse_content, level=3)

    theory_section = section(
        "Theoretical Background",
        prompt(t"{schrodinger_subsection:s1}\n{morse_subsection:s2}"),
        level=2
    )

    # -------------------------------------------------------------------------
    # Section 3: Installation & Setup
    # -------------------------------------------------------------------------

    setup_commands = code_block(
        "bash",
        prompt(
            t"""# Install required packages
pip install numpy scipy matplotlib

# Verify installation
python -c "import numpy; print(f'NumPy version: {{numpy.__version__}}')"
python -c "import scipy; print(f'SciPy version: {{scipy.__version__}}')" """
        )
    )

    setup_content = prompt(
        t"""**Prerequisites:** Python 3.8+ with scientific computing libraries.

**Installation steps:**

1. Set up a virtual environment (recommended)
2. Install `numpy` and `scipy` for numerical computation
3. Install `matplotlib` for visualization
4. Verify the installation

{setup_commands:commands}

*Optional:* Install `jupyter` for interactive exploration."""
    )

    setup_section = section("Setup", setup_content, level=2)

    # -------------------------------------------------------------------------
    # Section 4: Implementation
    # -------------------------------------------------------------------------

    # Build the Morse potential function with interpolated parameters
    # (called first time for standalone display)
    morse_func_standalone = build_morse_potential(D_e, a, r_e)
    morse_func_block = code_block("python", morse_func_standalone)

    # Solver configuration table
    solver_config = parameters_table(
        {
            "Grid points": "500",
            "r range": "0.3 - 3.0 Å",
            "Method": "Finite difference",
            "Basis": "Position space grid",
        }
    )

    # Build complete solver program
    # (call build_morse_potential again to get a fresh instance for embedding)
    morse_func_embedded = build_morse_potential(D_e, a, r_e)
    solver_program = build_solver_program(
        potential_name="morse_potential",
        potential_def=morse_func_embedded,
        grid_points="500",
        r_min="0.3",
        r_max="3.0"
    )
    solver_code_block = code_block("python", solver_program)

    implementation_warning = note_box(
        "This solver uses helper functions like `construct_kinetic_matrix()`, `diagonalize()`, and `normalize_wavefunctions()` which would be defined in a complete library.",
        icon="⚙️"
    )

    implementation_content = prompt(
        t"""We'll build a modular solver with **pluggable components** for different potentials.

### Potential Function Definition

{morse_func_block:func_def}

### Solver Configuration

{solver_config:config}

{implementation_warning:warning}

### Complete Solver

The full implementation constructs the Hamiltonian matrix using finite differences and solves the eigenvalue problem:

{solver_code_block:full_solver}"""
    )

    implementation_section = section("Implementation", implementation_content, level=2)

    # -------------------------------------------------------------------------
    # Section 5: Visualization & Results
    # -------------------------------------------------------------------------

    # Load and resize image using PIL
    from PIL import Image

    image_path = Path(__file__).parent.parent.parent.parent.parent / "docs" / "demos" / "assets" / "warps-and-wefts.png"

    # Load the image
    img = Image.open(image_path)

    # Resize to 400x400
    img_resized = img.resize((400, 400), Image.Resampling.LANCZOS)

    # Use the resized PIL Image in the prompt
    visualization_intro = prompt(
        t"""The solver computes both energy eigenvalues and corresponding wavefunctions (eigenstates).

**Example Visualization:**

{img_resized:viz}

*Note: This image shows a textile pattern, but in a real analysis, you would see wavefunction probability densities |ψ(r)|² overlaid with the Morse potential curve.*"""
    )

    # Results table
    results_table = parameters_table(
        {
            "E₀ (ground)": "0.1234 eV",
            "E₁ (1st excited)": "0.3456 eV",
            "E₂ (2nd excited)": "0.5432 eV",
            "ΔE₀₁": "0.2222 eV",
            "ΔE₁₂": "0.1976 eV (anharmonicity!)",
        }
    )

    results_content = prompt(
        t"""### Computational Results

{results_table:results}

---

**Key Observations:**

- Energy levels are *not* equally spaced (unlike harmonic oscillator)
- Spacing decreases at higher energies → **anharmonic behavior**
- Ground state energy matches analytical Morse prediction within 0.1%
- Convergence achieved with 500 grid points"""
    )

    visualization_section = section(
        "Visualization & Results",
        prompt(t"{visualization_intro:intro}\n\n{results_content:results}"),
        level=2
    )

    # -------------------------------------------------------------------------
    # Section 6: References
    # -------------------------------------------------------------------------

    references_content = prompt(
        t"""**Further Reading:**

- [Morse Potential on Wikipedia](https://en.wikipedia.org/wiki/Morse_potential) - comprehensive overview
- [NumPy Documentation](https://numpy.org/doc/stable/) - numerical array operations
- [SciPy Linear Algebra](https://docs.scipy.org/doc/scipy/reference/linalg.html) - eigenvalue solvers
- **Textbook:** *Molecular Quantum Mechanics* by Atkins & Friedman (Oxford University Press)

**Related Topics:**

- Harmonic oscillator approximation
- Vibrational spectroscopy
- Potential energy surfaces
- Variational methods in quantum mechanics"""
    )

    references_section = section("Further Reading", references_content, level=2)

    # -------------------------------------------------------------------------
    # Compose Final Document
    # -------------------------------------------------------------------------

    title = prompt(t"# Quantum Chemistry Computational Workflow\n## Solving the Morse Oscillator Problem\n\n")

    full_document = prompt(
        t"""{title:header}{overview_section:s1}{theory_section:s2}{setup_section:s3}{implementation_section:s4}{visualization_section:s5}{references_section:s6}"""
    )

    return full_document


# =============================================================================
# Preview Entry Point
# =============================================================================

if __name__ == "__main__":
    run_preview(__file__, create_quantum_workflow_demo)
