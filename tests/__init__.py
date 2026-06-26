# Top‑level test package for Django discovery
# Resolve conflict where a nested 'tests' package exists inside the strategy app.
# We alias the strategy.tests package as the top‑level 'tests' module.
import sys
from importlib import import_module

try:
    strategy_tests = import_module('strategy.tests')
    # Register the imported package under the current module name ('tests')
    sys.modules[__name__] = strategy_tests
except Exception:
    # If import fails, fall back to a no‑op to avoid breaking imports.
    pass
