import yaml
from pathlib import Path
from typing import Any, Dict

class Config:
    """A simple class to manage YAML configuration."""

    def __init__(self, yaml_file: Path):
        """Initializes the Config object by loading a YAML file."""
        with open(yaml_file, 'r') as f:
            self._config = yaml.safe_load(f)

    def get(self, key: str, default: Any = None) -> Any:
        """Gets a value from the configuration.

        Args:
            key: The key to look up.
            default: The default value to return if the key is not found.

        Returns:
            The value from the configuration or the default value.
        """
        return self._config.get(key, default)

    @property
    def model(self) -> str:
        """The default model to use for the workflow."""
        return self.get('model', 'gemini-1.5-pro-latest')

    @property
    def run_name(self) -> str:
        """The name of the run."""
        return self.get('run_name', 'global-run')

    @property
    def workflow(self) -> list:
        """The workflow steps."""
        return self.get('workflow', [])

    @property
    def page_ranges(self) -> list:
        """The page ranges to process."""
        return self.get('page_ranges', [])

    @property
    def pdf_file(self) -> Path | None:
        """The path to the source PDF file."""
        pdf_file = self.get('pdf_file')
        return Path(pdf_file) if pdf_file else None

    def __getitem__(self, key: str) -> Any:
        """Allows dictionary-style access to the configuration."""
        return self._config[key]

    def __contains__(self, key: str) -> bool:
        """Allows checking for the existence of a key using 'in'."""
        return key in self._config
