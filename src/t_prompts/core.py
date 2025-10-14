"""Core implementation of structured prompts."""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from string.templatelib import Template, convert
from typing import Any, Optional, Union

from .exceptions import (
    DuplicateKeyError,
    EmptyExpressionError,
    MissingKeyError,
    NotANestedPromptError,
    UnsupportedValueTypeError,
)


@dataclass(frozen=True, slots=True)
class StructuredInterpolation:
    """
    Immutable record of one interpolation occurrence in a StructuredPrompt.

    Attributes
    ----------
    key : str
        The key used for dict-like access (from format_spec if provided, else expression).
    expression : str
        The original expression text from the t-string (what was inside {}).
    conversion : str | None
        The conversion flag if present (!s, !r, !a), or None.
    format_spec : str
        The format specification string (everything after :), or empty string.
    value : str | StructuredPrompt
        The evaluated value (either a string or nested StructuredPrompt).
    parent : StructuredPrompt | None
        The parent StructuredPrompt that contains this interpolation.
    index : int
        The position of this interpolation among all interpolations in the parent.
    """

    key: str
    expression: str
    conversion: Optional[str]
    format_spec: str
    value: Union[str, "StructuredPrompt"]
    parent: Optional["StructuredPrompt"]
    index: int

    def __getitem__(self, key: str) -> "StructuredInterpolation":
        """
        Delegate dict-like access to nested StructuredPrompt if present.

        Parameters
        ----------
        key : str
            The key to look up in the nested prompt.

        Returns
        -------
        StructuredInterpolation
            The interpolation node from the nested prompt.

        Raises
        ------
        NotANestedPromptError
            If the value is not a StructuredPrompt.
        """
        if isinstance(self.value, StructuredPrompt):
            return self.value[key]
        raise NotANestedPromptError(self.key)

    def render(self) -> str:
        """
        Render this interpolation node to a string.

        If the value is a StructuredPrompt, renders it recursively.
        If a conversion is present, applies it using string.templatelib.convert.

        Returns
        -------
        str
            The rendered string value of this interpolation.
        """
        if isinstance(self.value, StructuredPrompt):
            out = self.value.render()
        else:
            out = self.value
        return convert(out, self.conversion) if self.conversion else out

    def __repr__(self) -> str:
        """Return a helpful debug representation."""
        value_repr = "StructuredPrompt(...)" if isinstance(self.value, StructuredPrompt) else repr(self.value)
        return (
            f"StructuredInterpolation(key={self.key!r}, expression={self.expression!r}, "
            f"conversion={self.conversion!r}, format_spec={self.format_spec!r}, "
            f"value={value_repr}, index={self.index})"
        )


class StructuredPrompt(Mapping[str, StructuredInterpolation]):
    """
    A provenance-preserving, navigable tree representation of a t-string.

    StructuredPrompt wraps a string.templatelib.Template (from a t-string)
    and provides dict-like access to its interpolations, preserving full
    provenance information (expression, conversion, format_spec, value).

    Parameters
    ----------
    template : Template
        The Template object from a t-string literal.
    allow_duplicate_keys : bool, optional
        If True, allows duplicate keys and provides get_all() for access.
        If False (default), raises DuplicateKeyError on duplicate keys.

    Raises
    ------
    UnsupportedValueTypeError
        If any interpolation value is neither str nor StructuredPrompt.
    DuplicateKeyError
        If duplicate keys are found and allow_duplicate_keys=False.
    EmptyExpressionError
        If an empty expression {} is encountered.
    """

    def __init__(self, template: Template, *, allow_duplicate_keys: bool = False):
        self._template = template
        self._interps: list[StructuredInterpolation] = []
        self._allow_duplicates = allow_duplicate_keys

        # Index maps keys to interpolation indices
        # If allow_duplicates, maps to list of indices; otherwise, maps to single index
        self._index: dict[str, Union[int, list[int]]] = {}

        self._build_nodes()

    def _build_nodes(self) -> None:
        """Build StructuredInterpolation nodes from the template's interpolations."""
        for idx, itp in enumerate(self._template.interpolations):
            # Derive key: format_spec if non-empty, else expression
            key = itp.format_spec if itp.format_spec else itp.expression

            # Guard against empty expressions
            if not key:
                raise EmptyExpressionError()

            # Validate and extract value
            val = itp.value
            if isinstance(val, StructuredPrompt):
                node_val = val
            elif isinstance(val, str):
                node_val = val
            else:
                raise UnsupportedValueTypeError(key, type(val), itp.expression)

            # Create the interpolation node
            node = StructuredInterpolation(
                key=key,
                expression=itp.expression,
                conversion=itp.conversion,
                format_spec=itp.format_spec,
                value=node_val,
                parent=self,
                index=idx,
            )
            self._interps.append(node)

            # Update index
            if self._allow_duplicates:
                if key not in self._index:
                    self._index[key] = []
                self._index[key].append(idx)  # type: ignore
            else:
                if key in self._index:
                    raise DuplicateKeyError(key)
                self._index[key] = idx

    # Mapping protocol implementation

    def __getitem__(self, key: str) -> StructuredInterpolation:
        """
        Get the interpolation node for the given key.

        Parameters
        ----------
        key : str
            The key to look up (derived from format_spec or expression).

        Returns
        -------
        StructuredInterpolation
            The interpolation node for this key.

        Raises
        ------
        MissingKeyError
            If the key is not found.
        ValueError
            If allow_duplicate_keys=True and the key is ambiguous (use get_all instead).
        """
        if key not in self._index:
            raise MissingKeyError(key, list(self._index.keys()))

        idx = self._index[key]
        if isinstance(idx, list):
            if len(idx) > 1:
                raise ValueError(f"Ambiguous key '{key}' with {len(idx)} occurrences. Use get_all('{key}') instead.")
            idx = idx[0]

        return self._interps[idx]

    def __iter__(self) -> Iterable[str]:
        """Iterate over keys in insertion order."""
        seen = set()
        for node in self._interps:
            if node.key not in seen:
                yield node.key
                seen.add(node.key)

    def __len__(self) -> int:
        """Return the number of unique keys."""
        return len(set(node.key for node in self._interps))

    def get_all(self, key: str) -> list[StructuredInterpolation]:
        """
        Get all interpolation nodes for a given key (for duplicate keys).

        Parameters
        ----------
        key : str
            The key to look up.

        Returns
        -------
        list[StructuredInterpolation]
            List of all interpolation nodes with this key.

        Raises
        ------
        MissingKeyError
            If the key is not found.
        """
        if key not in self._index:
            raise MissingKeyError(key, list(self._index.keys()))

        idx = self._index[key]
        if isinstance(idx, list):
            return [self._interps[i] for i in idx]
        else:
            return [self._interps[idx]]

    # Properties for provenance

    @property
    def template(self) -> Template:
        """Return the original Template object."""
        return self._template

    @property
    def strings(self) -> tuple[str, ...]:
        """Return the static string segments from the template."""
        return self._template.strings

    @property
    def interpolations(self) -> tuple[StructuredInterpolation, ...]:
        """Return all interpolation nodes in order."""
        return tuple(self._interps)

    # Rendering

    def render(self) -> str:
        """
        Render this StructuredPrompt to a string.

        Format specs are NOT applied during rendering - they are used only as key labels.
        Conversions (!s, !r, !a) are always applied.

        Returns
        -------
        str
            The rendered string.
        """
        out = []
        strings = list(self._template.strings)
        itps = iter(self._interps)

        # Add first string segment
        out.append(strings[0])

        # Interleave interpolations and remaining string segments
        for s in strings[1:]:
            node = next(itps)

            # Get value (render recursively if nested)
            if isinstance(node.value, StructuredPrompt):
                v = node.value.render()
            else:
                v = node.value

            # Apply conversion if present
            v = convert(v, node.conversion) if node.conversion else v

            out.append(v)
            out.append(s)

        return "".join(out)

    def __str__(self) -> str:
        """Render to string (convenience for render())."""
        return self.render()

    # Convenience methods for JSON export

    def to_values(self) -> dict[str, Any]:
        """
        Export a JSON-serializable dict of rendered values.

        Nested StructuredPrompts are recursively converted to dicts.

        Returns
        -------
        dict[str, Any]
            A dictionary mapping keys to rendered string values or nested dicts.
        """
        result = {}
        for node in self._interps:
            if isinstance(node.value, StructuredPrompt):
                result[node.key] = node.value.to_values()
            else:
                result[node.key] = node.render()
        return result

    def to_provenance(self) -> dict[str, Any]:
        """
        Export a JSON-serializable dict with full provenance information.

        Returns
        -------
        dict[str, Any]
            A dictionary with 'strings' (the static segments) and 'nodes'
            (list of dicts with key, expression, conversion, format_spec, and value info).
        """
        nodes_data = []
        for node in self._interps:
            node_dict = {
                "key": node.key,
                "expression": node.expression,
                "conversion": node.conversion,
                "format_spec": node.format_spec,
                "index": node.index,
            }
            if isinstance(node.value, StructuredPrompt):
                node_dict["value"] = node.value.to_provenance()
            else:
                node_dict["value"] = node.value
            nodes_data.append(node_dict)

        return {"strings": list(self._template.strings), "nodes": nodes_data}

    def __repr__(self) -> str:
        """Return a helpful debug representation."""
        keys = ", ".join(repr(k) for k in list(self)[:3])
        if len(self) > 3:
            keys += ", ..."
        return f"StructuredPrompt(keys=[{keys}], num_interpolations={len(self._interps)})"


def prompt(template: Template, /, **opts) -> StructuredPrompt:
    """
    Build a StructuredPrompt from a t-string Template.

    This is the main entry point for creating structured prompts.

    Parameters
    ----------
    template : Template
        The Template object from a t-string literal (e.g., t"...").
    **opts
        Additional options passed to StructuredPrompt constructor
        (e.g., allow_duplicate_keys=True).

    Returns
    -------
    StructuredPrompt
        The structured prompt object.

    Raises
    ------
    TypeError
        If template is not a Template object.

    Examples
    --------
    >>> instructions = "Always answer politely."
    >>> p = prompt(t"Obey {instructions:inst}")
    >>> str(p)
    'Obey Always answer politely.'
    >>> p['inst'].expression
    'instructions'
    """
    if not isinstance(template, Template):
        raise TypeError("prompt(...) requires a t-string Template")
    return StructuredPrompt(template, **opts)
