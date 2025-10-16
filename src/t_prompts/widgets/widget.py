"""Widget class for Jupyter notebook rendering."""


class Widget:
    """
    Wrapper class for widget HTML content.

    This is a simple utility class that holds the rendered HTML string
    and provides the _repr_html_() method for Jupyter notebook display.

    Attributes
    ----------
    html : str
        The HTML content to display.
    """

    def __init__(self, html: str):
        """
        Create a Widget with the given HTML content.

        Parameters
        ----------
        html : str
            The HTML string to display.
        """
        self.html = html

    def _repr_html_(self) -> str:
        """
        Return HTML representation for Jupyter notebook display.

        This method is automatically called by Jupyter/IPython when displaying
        a Widget in a notebook cell.

        Returns
        -------
        str
            The HTML content.
        """
        return self.html
