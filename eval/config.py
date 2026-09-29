"""Paths, model names and constants for the eval. Loads settings from the repo's .env."""

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

# The core CLI labels turns with the same on-device model as the extension. The synthetic dataset is
# written by any OpenAI-compatible chat API (generate.py), ideally a different model family from the labeler.
LABELER_MODEL = "onnx-community/embeddinggemma-300m-ONNX"  # must match MODEL_ID in core/src/config.ts
GENERATOR_API_KEY = os.environ.get("GENERATOR_API_KEY", "")
GENERATOR_BASE_URL = os.environ.get("GENERATOR_BASE_URL") or None  # None: OpenAI's own API
GENERATOR_MODEL = os.environ.get("GENERATOR_MODEL", "")

DATA = ROOT / "eval" / "data"
RESULTS = ROOT / "eval" / "results"
CONVERSATIONS = DATA / "conversations.jsonl"
ARCS = DATA / "arcs.jsonl"
HELDOUT_GOLD = DATA / "heldout_gold.csv"
LABELS_CACHE = DATA / "labels_cache.jsonl"
KEYWORDS = ROOT / "eval" / "keywords.tsv"
CORE_CLI = ROOT / "core" / "dist" / "cli.js"

BASE_TS = 1788220800000  # day 1 = 2026-09-01 00:00 UTC
DAY_MS = 86_400_000
LEVELS = ["healthy", "watch", "concerning", "crisis"]
