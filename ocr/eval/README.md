# OCR Accuracy Eval

Regression-detection harness for the `/extract-id` pipeline. Catches accuracy drops when extractors, cleaners, or the OCR engine change.

## Layout

```
eval/
  images/         # gitignored — source images (PII)
    ktp/
    sim_modern/
    sim_6_line/
    sim_old/
    negative/
  labels/         # gitignored — ground-truth JSON sidecars (PII)
    ktp/001.json
    ...
  cache/          # gitignored — cached OCR output, keyed by image hash
  baseline.json   # committed — aggregate accuracy snapshot, no PII
  bootstrap_labels.py
  run_eval.py
```

## Dataset composition

- ~150 valid images, ~37 per type across `ktp`, `sim_modern`, `sim_6_line`, `sim_old`
- ~10 negative samples (non-ID, blank, unreadable) under `negative/`
- Stratified by `id_type` only

## Label file format

One JSON sidecar per image. Image `images/ktp/001.jpg` ↔ label `labels/ktp/001.json`.

### Valid sample

```json
{
  "type": "ktp",
  "reviewed": true,
  "data": {
    "nik": "1234567890123456",
    "nama": "JOHN DOE",
    "tanggal_lahir": "01-01-1990",
    "golongan_darah": "-",
    "...": "..."
  }
}
```

### Negative sample

```json
{
  "expected": "no_text_detected",
  "reviewed": true
}
```

## Labeling rules

Transcribe values **in the format the system produces**, not as they appear on the card. The eval does minimal normalization (whitespace strip, `null == ""`) — everything else is byte-equal.

| Field group | Convention |
| --- | --- |
| All text values | UPPERCASE |
| Dates (`tanggal_lahir`, `tanggal_berlaku`, `berlaku_hingga`) | `DD-MM-YYYY` (with dashes) |
| `golongan_darah` | `-` when blank/unreadable, else `O` / `A` / `B` / `AB` |
| `nik` | 16 digits, no spaces |
| `rt`, `rw` | 3 digits, e.g. `001` |
| Genuinely absent on card | `null` |
| `berlaku_hingga` for permanent KTP | `SEUMUR HIDUP` |

## Reviewer workflow

1. Run `bootstrap_labels.py` — generates draft `labels/<type>/NNN.json` files pre-filled with current model output and `reviewed: false`.
2. Open the image in Preview and the JSON in your editor, side by side.
3. **Read each field from the image first, then check the model's value.** Anchoring on the model's output is the failure mode this eval is designed to surface — don't make it worse during labeling.
4. Correct values to match conventions above.
5. Flip `reviewed: true`.
6. Records with `reviewed: false` are skipped by the eval with a warning.

## Running the eval

```bash
.venv/bin/python eval/run_eval.py
```

Output: per-field accuracy, per-type accuracy, per-record failure log. No automated pass/fail threshold — human decides whether a drop is a real regression.

OCR output is cached in `cache/` keyed by `(image_hash, ocr_config_hash)`. Changing the OCR engine config invalidates the cache; changing extractor logic does not (extractors always re-run fresh).

## PII

Images and labels both contain real KTP/SIM data and are gitignored. Back up `eval/` to a private location separately — git is not your backup. Only `baseline.json`, the scripts, and this README go to the repo.
