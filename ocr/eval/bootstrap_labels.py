"""Bootstrap draft eval labels from current model predictions.

Walks eval/images/<type>/*.{jpg,jpeg,png}, runs the extraction pipeline,
writes draft labels to eval/labels/<type>/<basename>.json with reviewed: false.

Existing label files are NOT overwritten — safe to re-run after partial labeling.

Usage:
    .venv/bin/python eval/bootstrap_labels.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from eval.cache_util import cached_ocr  # noqa: E402
from extractors.pipeline import run_extraction  # noqa: E402

EVAL_DIR = Path(__file__).parent
IMAGES_DIR = EVAL_DIR / "images"
LABELS_DIR = EVAL_DIR / "labels"

VALID_TYPES = {"ktp", "sim_modern", "sim_6_line", "sim_old"}
NEGATIVE_TYPE = "negative"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def bootstrap_image(image_path: Path, label_path: Path, is_negative: bool) -> str:
    if label_path.exists():
        return "skipped"

    label_path.parent.mkdir(parents=True, exist_ok=True)

    if is_negative:
        label = {"expected": "no_text_detected", "reviewed": False}
    else:
        items = cached_ocr(image_path.read_bytes())
        if not items:
            label = {"expected": "no_text_detected", "reviewed": False}
        else:
            label = {"reviewed": False, **run_extraction(items)}

    label_path.write_text(json.dumps(label, indent=2, ensure_ascii=False) + "\n")
    return "wrote"


def main() -> None:
    if not IMAGES_DIR.exists():
        print(f"no images dir at {IMAGES_DIR}", file=sys.stderr)
        sys.exit(1)

    counts = {"wrote": 0, "skipped": 0}

    for type_dir in sorted(IMAGES_DIR.iterdir()):
        if not type_dir.is_dir():
            continue
        type_name = type_dir.name
        if type_name not in VALID_TYPES and type_name != NEGATIVE_TYPE:
            print(f"unknown type dir, skipping: {type_name}")
            continue

        for image_path in sorted(type_dir.iterdir()):
            if image_path.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            label_path = LABELS_DIR / type_name / (image_path.stem + ".json")
            status = bootstrap_image(
                image_path, label_path, type_name == NEGATIVE_TYPE
            )
            counts[status] += 1
            print(f"{status}: {image_path.relative_to(EVAL_DIR)}")

    print(f"\ndone: wrote={counts['wrote']} skipped={counts['skipped']}")


if __name__ == "__main__":
    main()
