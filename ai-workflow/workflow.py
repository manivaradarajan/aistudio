#!/usr/bin/env python3
"""
This script is the main entry point for the workflow engine.

It imports and calls the main function from the workflow_engine package,
allowing the workflow to be run directly from the root directory as a standard
Python script.
"""

from workflow_engine.main import main

if __name__ == "__main__":
    # The main function in the workflow_engine.main module is designed
    # to handle command-line arguments, so we can simply call it.
    main()
