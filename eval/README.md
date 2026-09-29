# Eval

Measures whether Bridge.ai's 7-day pattern engine catches unhealthy chatbot relationships earlier than the same labels used message by message, and earlier than a keyword filter. Synthetic data only, never real people's data.

```bash
npm run build -w core                              # the eval calls core/dist/cli.js
uv run python -m eval.generate --conversations 160 --arcs 25
uv run python -m eval.hand_label --split heldout --labeler <name>
uv run python -m eval.run --split tuning [--rules-only]
```

The first `eval.run` downloads the on-device model (about 200 MB) into Transformers.js's cache.

## Data (`data/`)

`conversations.jsonl`, one per line:

```json
{"id": "conv_001", "site": "chatgpt", "gold": "watch", "hard_case": null, "split": "tuning",
 "turns": [{"role": "user", "text": "...", "ts": 1788225000000}, {"role": "bot", "text": "...", "ts": 1788225010000}]}
```

`hard_case` is `null` or one of `"poem_lonely"`, `"no_trigger_dependency"`, `"sarcasm"`, `"slang"`, `"dark_humor"`, `"quoted_lyrics"`.

`arcs.jsonl`, one multi-day conversation history per line:

```json
{"id": "arc_01", "site": "characterai", "gold_final": "concerning", "gold_first_concerning_day": 4, "split": "tuning",
 "sessions": [{"start": 1788220800000, "end": 1788222600000,
   "turns": [{"role": "user", "text": "...", "ts": 1788220900000}, {"role": "bot", "text": "...", "ts": 1788220910000}]}]}
```

`gold_first_concerning_day` is `null` for arcs that never reach concerning.

- **`generate.py`** writes both files with any OpenAI-compatible chat API (`GENERATOR_API_KEY`, `GENERATOR_MODEL` and optionally `GENERATOR_BASE_URL` in `.env`). Use a different model family from the labeler, so the labeler isn't graded against itself. Hand-check the output before using it.
- **`hand_label.py`** shows held-out items without the generator's label and appends `id,labeler,gold,first_concerning_day` to `heldout_gold.csv`. It resumes where it left off; items labeled by several people use the majority label.
- **`labels_cache.jsonl`** (git-ignored) caches labels by model and text.

## Systems compared (`run.py`)

- **Pattern engine**: `cli.js score --mode pattern`, the rolling 7-day profile the extension uses.
- **Per-message**: `cli.js score --mode single`, the same labels with no aggregation (level = worst single message).
- **Keyword filter** (`keyword_baseline.py`, `keywords.tsv`): `crisis` on any `self_harm` term, `concerning` on any `explicit` term, else `healthy`. Keep the list public-style; don't tailor it to the dataset.

## Metrics (`metrics.py`)

| Metric | Definition |
|---|---|
| Crisis recall | of gold `crisis` items, the share predicted `crisis` |
| Concerning precision | of items predicted `concerning`, the share whose gold is `concerning` or `crisis` |
| Healthy FPR | of gold `healthy` items, the share predicted `watch` or higher |
| Arc detection rate | of arcs with a gold first-concerning day, the share predicted `concerning` or higher on any day |
| Median days-to-detection | over detected arcs, the median first day predicted `concerning` or higher |
| Early flags | arcs flagged before their gold first-concerning day |

`run.py` prints the table and a confusion matrix per system, and writes `results/<split>-<timestamp>.json` (ids and levels only, no text). Tune weights (`core/src/weights.json`) and examples (`core/src/semantic/labels.ts`) on `tuning` only. **Run `heldout` once**, after tuning is done.
