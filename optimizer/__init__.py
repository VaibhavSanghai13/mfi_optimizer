"""VRPTW optimizer package used by api/optimize.py. The OR-Tools model is added in S8."""

import ortools


def ortools_version() -> str:
    return ortools.__version__
