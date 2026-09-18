from __future__ import annotations

MAX_INGESTED_FILES = 800

IGNORED_DIRECTORY_NAMES = frozenset(
    {
        ".git",
        "node_modules",
        "target",
        "build",
        "dist",
        "vendor",
        ".idea",
        ".vscode",
        "__pycache__",
        ".venv",
        "venv",
        "coverage",
        ".next",
        "out",
    }
)

HISTORY_ONLY_MIN_PARSEABLE_RATIO = 0.05
HISTORY_ONLY_MIN_EDGE_COUNT = 1
