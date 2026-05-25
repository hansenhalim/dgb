"""Calibrate spatial template constants for all ID types from reviewed eval labels.

For each type, walks reviewed eval/labels/<type>/*.json. For each card:
- Loads cached OCR + runs CleanOcrText (so item texts match runtime).
- Finds the type's reference anchors. If both present, computes a baseline.
- For each anchor in the priority list, records its position normalized to
  the reference-anchor frame (y in roughly [0, 1], x in same units).
- For each labeled field value, fuzzy-matches an OCR item and records its
  normalized position the same way. Combined fields are matched by
  concatenating ground-truth values.

Aggregates medians across cards and writes extractors/spatial_template.py
with constants for all 4 ID types.

Usage:
    .venv/bin/python eval/calibrate_template.py
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from statistics import median

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from rapidfuzz.distance import Levenshtein  # noqa: E402

from extractors.clean_ocr_text import CleanOcrText  # noqa: E402
from extractors.label_dictionary import LABELS  # noqa: E402
from extractors.ocr_item import OcrItem  # noqa: E402

EVAL_DIR = Path(__file__).parent
IMAGES_DIR = EVAL_DIR / "images"
LABELS_DIR = EVAL_DIR / "labels"
CACHE_DIR = EVAL_DIR / "cache"
OUTPUT_PATH = REPO_ROOT / "extractors" / "spatial_template.py"

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png")
MIN_FUZZY_RATIO = 0.2
MIN_SAMPLES_PER_FIELD = 3

# Per-type configurations.
# anchor_priority: ordered list of label texts (most-reliable first).
# reference_anchors: (top, bottom) pair used to normalize calibration data.
# fields: (field_name, gt_keys_to_concat, separator, multi_line, validator, splits_into)
KTP_CONFIG = {
    "subdir": "ktp",
    "anchor_priority": [
        "NIK", "Berlaku Hingga", "Nama", "Pekerjaan", "Kewarganegaraan",
        "Status Perkawinan", "Kecamatan", "Kel/Desa", "RT/RW", "Agama",
        "Alamat", "Tempat/Tgl Lahir", "Jenis kelamin", "Gol. Darah",
    ],
    "reference_anchors": ("NIK", "Berlaku Hingga"),
    "fields": [
        ("nik",               ["nik"],                              "",   False, "nik",            None),
        ("nama",              ["nama"],                             "",   False, "free",           None),
        ("tempat_tgl",        ["tempat_lahir", "tanggal_lahir"],    ", ", False, "tempat_tgl",     ["tempat_lahir", "tanggal_lahir"]),
        ("jenis_kelamin",     ["jenis_kelamin"],                    "",   False, "sex",            None),
        ("golongan_darah",    ["golongan_darah"],                   "",   False, "blood",          None),
        ("alamat",            ["alamat"],                           "",   True,  "free",           None),
        ("rt_rw",             ["rt", "rw"],                         "/",  False, "rt_rw",          ["rt", "rw"]),
        ("kelurahan",         ["kelurahan"],                        "",   False, "free",           None),
        ("kecamatan",         ["kecamatan"],                        "",   False, "free",           None),
        ("agama",             ["agama"],                            "",   False, "free",           None),
        ("status_perkawinan", ["status_perkawinan"],                "",   False, "free",           None),
        ("pekerjaan",         ["pekerjaan"],                        "",   False, "free",           None),
        ("kewarganegaraan",   ["kewarganegaraan"],                  "",   False, "free",           None),
        ("berlaku_hingga",    ["berlaku_hingga"],                   "",   False, "berlaku_hingga", None),
    ],
}

SIM_MODERN_CONFIG = {
    "subdir": "sim_modern",
    "anchor_priority": [
        "Nama/Name", "Diterbitkan Oleh/Issued By", "Tempat, Tgl Lahir/Place",
        "Alamat/Address", "Pekerjaan/Occupation", "Gol Darah/Blood type",
        "Jenis Kelamin/Sex",
    ],
    "reference_anchors": ("Nama/Name", "Diterbitkan Oleh/Issued By"),
    "fields": [
        ("nama",             ["nama"],                          "",   False, "free",       None),
        ("tempat_tgl",       ["tempat_lahir", "tanggal_lahir"], ", ", False, "tempat_tgl", ["tempat_lahir", "tanggal_lahir"]),
        ("golongan_darah",   ["golongan_darah"],                "",   False, "blood",      None),
        ("jenis_kelamin",    ["jenis_kelamin"],                 "",   False, "sex",        None),
        ("alamat",           ["alamat"],                        "",   True,  "free",       None),
        ("pekerjaan",        ["pekerjaan"],                     "",   False, "free",       None),
        ("tempat_pembuatan", ["tempat_pembuatan"],              "",   False, "free",       None),
    ],
}

SIM_SIX_LINE_CONFIG = {
    "subdir": "sim_6_line",
    "anchor_priority": ["2.", "6.", "5.", "3.", "4.", "1."],
    "reference_anchors": ("2.", "6."),
    "fields": [
        ("nama",             ["nama"],                          "",   False, "free",       None),
        ("tempat_tgl",       ["tempat_lahir", "tanggal_lahir"], ", ", False, "tempat_tgl", ["tempat_lahir", "tanggal_lahir"]),
        ("gol_sex",          ["golongan_darah", "jenis_kelamin"], " ",   False, "free",     ["golongan_darah", "jenis_kelamin"]),
        ("alamat",           ["alamat"],                        "",   True,  "free",       None),
        ("pekerjaan",        ["pekerjaan"],                     "",   False, "free",       None),
        ("tempat_pembuatan", ["tempat_pembuatan"],              "",   False, "free",       None),
    ],
}

SIM_OLD_CONFIG = {
    "subdir": "sim_old",
    "anchor_priority": [
        "Nama", "Berlaku s/d", "Alamat", "Tempat &", "Tgl.Lahir", "No. SIM", "Pekerjaan",
    ],
    "reference_anchors": ("Nama", "Berlaku s/d"),
    "fields": [
        ("nama",            ["nama"],            "", False, "free",       None),
        ("alamat",          ["alamat"],          "", True,  "free",       None),
        ("tempat_lahir",    ["tempat_lahir"],    "", False, "free",       None),
        ("tanggal_lahir",   ["tanggal_lahir"],   "", False, "date",       None),
        ("pekerjaan",       ["pekerjaan"],       "", False, "free",       None),
        ("nomor_sim",       ["nomor_sim"],       "", False, "nik",        None),
        ("tanggal_berlaku", ["tanggal_berlaku"], "", False, "date",       None),
    ],
}

ALL_CONFIGS = [
    ("KTP",          KTP_CONFIG),
    ("SIM_MODERN",   SIM_MODERN_CONFIG),
    ("SIM_SIX_LINE", SIM_SIX_LINE_CONFIG),
    ("SIM_OLD",      SIM_OLD_CONFIG),
]


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().upper())


def fuzzy_best_item(items: list[OcrItem], target: str) -> OcrItem | None:
    if not target:
        return None
    target_norm = normalize(target)
    if not target_norm:
        return None
    best: OcrItem | None = None
    best_score = float("inf")
    for it in items:
        item_norm = normalize(it.text)
        if not item_norm:
            continue
        distance = Levenshtein.distance(item_norm, target_norm)
        max_len = max(len(item_norm), len(target_norm))
        score = distance / max_len
        if score < best_score:
            best_score = score
            best = it
    return best if best_score < MIN_FUZZY_RATIO else None


def fuzzy_best_first_line(items: list[OcrItem], target: str) -> OcrItem | None:
    """For multi-line fields: find the OCR item whose text best matches the
    START of the ground-truth value. Returns the FIRST line item, anchoring
    the field's y position."""
    if not target:
        return None
    target_norm = normalize(target)
    if not target_norm:
        return None
    best: OcrItem | None = None
    best_score = float("inf")
    for it in items:
        item_norm = normalize(it.text)
        if not item_norm or len(item_norm) < 4 or len(item_norm) > len(target_norm):
            continue
        prefix = target_norm[: len(item_norm)]
        distance = Levenshtein.distance(item_norm, prefix)
        score = distance / len(item_norm)
        if score < best_score:
            best_score = score
            best = it
    return best if best_score < MIN_FUZZY_RATIO else None


def find_exact_anchor(items: list[OcrItem], label: str) -> OcrItem | None:
    for it in items:
        if it.text == label:
            return it
    return None


def collect_samples(config: dict) -> dict:
    field_y: dict[str, list[float]] = defaultdict(list)
    field_x: dict[str, list[float]] = defaultdict(list)
    anchor_y: dict[str, list[float]] = defaultdict(list)
    anchor_x: dict[str, list[float]] = defaultdict(list)
    counts = {
        "used": 0,
        "skipped_unreviewed": 0,
        "skipped_no_image": 0,
        "skipped_no_cache": 0,
        "skipped_missing_ref_anchors": 0,
        "skipped_zero_baseline": 0,
        "skipped_negative": 0,
    }

    cleaner = CleanOcrText()
    subdir = config["subdir"]
    label_dir = LABELS_DIR / subdir
    image_dir = IMAGES_DIR / subdir
    ref_top_label, ref_bot_label = config["reference_anchors"]

    if not label_dir.exists():
        return {"field_y": {}, "field_x": {}, "anchor_y": {}, "anchor_x": {}, "counts": counts}

    for label_path in sorted(label_dir.glob("*.json")):
        label = json.loads(label_path.read_text())
        if not label.get("reviewed"):
            counts["skipped_unreviewed"] += 1
            continue
        if "data" not in label or label.get("expected"):
            counts["skipped_negative"] += 1
            continue

        image_path: Path | None = None
        for ext in IMAGE_EXTENSIONS:
            p = image_dir / (label_path.stem + ext)
            if p.exists():
                image_path = p
                break
        if image_path is None:
            counts["skipped_no_image"] += 1
            continue

        h = hashlib.sha256(image_path.read_bytes()).hexdigest()
        cache_path = CACHE_DIR / f"{h}.json"
        if not cache_path.exists():
            counts["skipped_no_cache"] += 1
            continue

        raw_items = json.loads(cache_path.read_text())
        items = [OcrItem(text=i["text"], rec_poly=i["rec_poly"]) for i in raw_items]
        cleaned = cleaner.execute(items, LABELS)

        ref_top = find_exact_anchor(cleaned, ref_top_label)
        ref_bot = find_exact_anchor(cleaned, ref_bot_label)
        if ref_top is None or ref_bot is None:
            counts["skipped_missing_ref_anchors"] += 1
            continue

        baseline = ref_bot.center_y() - ref_top.center_y()
        if baseline <= 0:
            counts["skipped_zero_baseline"] += 1
            continue

        counts["used"] += 1

        def to_offsets(item: OcrItem, top: OcrItem = ref_top, base: float = baseline) -> tuple[float, float]:
            return (
                (item.center_y() - top.center_y()) / base,
                (item.left() - top.left()) / base,
            )

        for anchor_label in config["anchor_priority"]:
            anchor_item = find_exact_anchor(cleaned, anchor_label)
            if anchor_item is None:
                continue
            yo, xo = to_offsets(anchor_item)
            anchor_y[anchor_label].append(yo)
            anchor_x[anchor_label].append(xo)

        ground_truth = label["data"]
        for field_name, gt_keys, sep, multi, _val, _splits in config["fields"]:
            parts = [ground_truth.get(k) for k in gt_keys]
            if any(p is None or p == "" for p in parts):
                continue
            target = sep.join(parts)
            if multi:
                matched = fuzzy_best_first_line(cleaned, target) or fuzzy_best_item(cleaned, target)
            else:
                matched = fuzzy_best_item(cleaned, target)
            if matched is None:
                continue
            yo, xo = to_offsets(matched)
            field_y[field_name].append(yo)
            field_x[field_name].append(xo)

    return {
        "field_y": field_y,
        "field_x": field_x,
        "anchor_y": anchor_y,
        "anchor_x": anchor_x,
        "counts": counts,
    }


def aggregate(samples: dict[str, list[float]]) -> dict[str, tuple[float, int]]:
    out: dict[str, tuple[float, int]] = {}
    for k, vals in samples.items():
        if len(vals) < MIN_SAMPLES_PER_FIELD:
            print(f"    WARN: {k!r} has only {len(vals)} samples; dropping")
            continue
        out[k] = (round(median(vals), 4), len(vals))
    return out


def render_type_block(type_name: str, config: dict, aggregated: dict) -> list[str]:
    field_meta = {
        name: {"multi_line": multi, "validator": val, "splits_into": splits}
        for name, _, _, multi, val, splits in config["fields"]
    }

    lines: list[str] = []
    lines.append(f"{type_name}_REFERENCE_ANCHORS = (")
    lines.append(f"    {config['reference_anchors'][0]!r},")
    lines.append(f"    {config['reference_anchors'][1]!r},")
    lines.append(")")
    lines.append("")
    lines.append(f"{type_name}_ANCHOR_PRIORITY = [")
    for a in config["anchor_priority"]:
        lines.append(f"    {a!r},")
    lines.append("]")
    lines.append("")
    lines.append(f"{type_name}_ANCHOR_OFFSETS: dict[str, dict] = {{")
    for label in config["anchor_priority"]:
        if label not in aggregated["anchor_y"] or label not in aggregated["anchor_x"]:
            continue
        y, ny = aggregated["anchor_y"][label]
        x, nx = aggregated["anchor_x"][label]
        lines.append(f"    {label!r}: {{")
        lines.append(f'        "y_offset": {y},')
        lines.append(f'        "x_offset": {x},')
        lines.append(f'        "samples": {min(ny, nx)},')
        lines.append("    },")
    lines.append("}")
    lines.append("")
    lines.append(f"{type_name}_FIELDS: dict[str, dict] = {{")
    for name, _, _, _, _, _ in config["fields"]:
        if name not in aggregated["field_y"] or name not in aggregated["field_x"]:
            continue
        y, ny = aggregated["field_y"][name]
        x, nx = aggregated["field_x"][name]
        meta = field_meta[name]
        lines.append(f"    {name!r}: {{")
        lines.append(f'        "y_offset": {y},')
        lines.append(f'        "x_offset": {x},')
        lines.append(f'        "multi_line": {meta["multi_line"]},')
        lines.append(f'        "validator": {meta["validator"]!r},')
        lines.append(f'        "splits_into": {meta["splits_into"]!r},')
        lines.append(f'        "samples": {min(ny, nx)},')
        lines.append("    },")
    lines.append("}")
    lines.append("")
    return lines


def main() -> None:
    all_aggregated: dict[str, dict] = {}

    for type_name, config in ALL_CONFIGS:
        print(f"--- Calibrating {type_name} ---")
        samples = collect_samples(config)
        for k, v in samples["counts"].items():
            print(f"  {k}: {v}")
        if samples["counts"]["used"] == 0:
            print(f"  No usable cards for {type_name}; skipping output.\n")
            all_aggregated[type_name] = None
            continue
        print(f"  Aggregating field offsets...")
        field_y = aggregate(samples["field_y"])
        field_x = aggregate(samples["field_x"])
        print(f"  Aggregating anchor offsets...")
        anchor_y = aggregate(samples["anchor_y"])
        anchor_x = aggregate(samples["anchor_x"])
        all_aggregated[type_name] = {
            "field_y": field_y,
            "field_x": field_x,
            "anchor_y": anchor_y,
            "anchor_x": anchor_x,
        }
        print()

    lines: list[str] = [
        '"""Spatial template constants for ID-card field positions.',
        "",
        "Auto-generated by eval/calibrate_template.py. Do not hand-edit;",
        "re-run the calibration script when the eval set grows materially.",
        "",
        "Offsets are normalized to the type's reference-anchor baseline:",
        "y_offset = (item.center_y - top_anchor.center_y) / baseline",
        "x_offset = (item.left      - top_anchor.left)     / baseline",
        "where baseline = bottom_anchor.center_y - top_anchor.center_y.",
        '"""',
        "from __future__ import annotations",
        "",
    ]

    for type_name, _ in ALL_CONFIGS:
        agg = all_aggregated.get(type_name)
        config = dict(ALL_CONFIGS)[type_name]
        if agg is None:
            continue
        lines.extend(render_type_block(type_name, config, agg))

    OUTPUT_PATH.write_text("\n".join(lines))
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
