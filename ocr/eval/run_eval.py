"""Run the accuracy eval and print a report.

Walks eval/labels/<type>/*.json, finds matching images under eval/images/,
runs the extraction pipeline (with cached OCR), compares predictions to
ground truth, prints per-type / per-field / failure-log report.

Usage:
    .venv/bin/python eval/run_eval.py
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from eval.cache_util import cached_ocr  # noqa: E402
from extractors.pipeline import run_extraction  # noqa: E402

EVAL_DIR = Path(__file__).parent
IMAGES_DIR = EVAL_DIR / "images"
LABELS_DIR = EVAL_DIR / "labels"

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png")


def find_image(type_name: str, stem: str) -> Path | None:
    for ext in IMAGE_EXTENSIONS:
        p = IMAGES_DIR / type_name / (stem + ext)
        if p.exists():
            return p
    return None


def normalize(value) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    s = re.sub(r"\s+", " ", s)
    if s == "":
        return None
    return s


def values_equal(predicted, expected) -> bool:
    return normalize(predicted) == normalize(expected)


def evaluate_valid(label: dict, predicted: dict) -> tuple[bool, list[tuple[str, bool, object, object]]]:
    """Returns (type_match, [(field, ok, predicted, expected), ...])"""
    expected_type = label["type"]
    predicted_type = predicted["type"]
    type_match = expected_type == predicted_type

    field_results: list[tuple[str, bool, object, object]] = []

    if not type_match:
        for field, expected_value in label["data"].items():
            field_results.append((field, False, predicted.get("data", {}).get(field), expected_value))
    else:
        for field, expected_value in label["data"].items():
            predicted_value = predicted["data"].get(field)
            ok = values_equal(predicted_value, expected_value)
            field_results.append((field, ok, predicted_value, expected_value))

    return type_match, field_results


def evaluate_negative(image_path: Path) -> bool:
    items = cached_ocr(image_path.read_bytes())
    return len(items) == 0


def pct(num: int, denom: int) -> str:
    if denom == 0:
        return "n/a"
    return f"{num}/{denom} ({100 * num / denom:.1f}%)"


def rate(num: int, denom: int) -> float:
    if denom == 0:
        return 0.0
    return num / denom


def write_snapshot(
    type_total: dict[str, int],
    type_correct: dict[str, int],
    field_total: dict[str, int],
    field_correct: dict[str, int],
) -> dict:
    aggregates = {
        "type_accuracy": {
            "overall": rate(sum(type_correct.values()), sum(type_total.values())),
            **{t: rate(type_correct[t], type_total[t]) for t in sorted(type_total)},
        },
        "field_accuracy": {
            "overall": rate(sum(field_correct.values()), sum(field_total.values())),
            **{f: rate(field_correct[f], field_total[f]) for f in sorted(field_total)},
        },
    }
    (EVAL_DIR / "last_run.json").write_text(json.dumps(aggregates, indent=2) + "\n")

    baseline_path = EVAL_DIR / "baseline.json"
    if not baseline_path.exists():
        baseline_path.write_text(json.dumps(aggregates, indent=2) + "\n")

    return aggregates


def print_delta(current: dict, baseline: dict) -> None:
    print("Δ vs baseline:")
    any_diff = False
    for category in ("type_accuracy", "field_accuracy"):
        for k in sorted(current[category]):
            if k not in baseline.get(category, {}):
                continue
            diff = current[category][k] - baseline[category][k]
            if abs(diff) < 0.001:
                continue
            any_diff = True
            sign = "+" if diff > 0 else ""
            print(f"  {category}.{k}: {sign}{diff * 100:.1f}pp")
    if not any_diff:
        print("  (no change ≥0.1pp)")


def main() -> None:
    if not LABELS_DIR.exists():
        print(f"no labels dir at {LABELS_DIR}", file=sys.stderr)
        sys.exit(1)

    reviewed_count = 0
    unreviewed_count = 0
    missing_image_count = 0

    type_total: dict[str, int] = defaultdict(int)
    type_correct: dict[str, int] = defaultdict(int)

    field_total: dict[str, int] = defaultdict(int)
    field_correct: dict[str, int] = defaultdict(int)

    failures: list[str] = []

    for type_dir in sorted(LABELS_DIR.iterdir()):
        if not type_dir.is_dir():
            continue
        type_name = type_dir.name

        for label_path in sorted(type_dir.glob("*.json")):
            label = json.loads(label_path.read_text())

            if not label.get("reviewed"):
                unreviewed_count += 1
                continue
            reviewed_count += 1

            image_path = find_image(type_name, label_path.stem)
            if image_path is None:
                missing_image_count += 1
                failures.append(f"{type_name}/{label_path.stem}: image not found")
                continue

            type_total[type_name] += 1

            if type_name == "negative":
                ok = evaluate_negative(image_path)
                if ok:
                    type_correct[type_name] += 1
                else:
                    failures.append(f"{type_name}/{label_path.stem}: expected no_text_detected, got text")
                continue

            items = cached_ocr(image_path.read_bytes())
            if not items:
                failures.append(f"{type_name}/{label_path.stem}: pipeline returned no_text_detected, expected {label['type']}")
                for field in label["data"]:
                    field_total[field] += 1
                continue

            predicted = run_extraction(items)
            type_match, field_results = evaluate_valid(label, predicted)

            if type_match:
                type_correct[type_name] += 1
                for field, ok, pred_val, exp_val in field_results:
                    field_total[field] += 1
                    if ok:
                        field_correct[field] += 1
                    else:
                        failures.append(
                            f"{type_name}/{label_path.stem}: {field} mismatch "
                            f"(predicted={pred_val!r}, expected={exp_val!r})"
                        )
            else:
                failures.append(
                    f"{type_name}/{label_path.stem}: type mismatch "
                    f"(predicted={predicted['type']}, expected={label['type']})"
                )
                for field, _ok, _pred_val, _exp_val in field_results:
                    field_total[field] += 1

    print("=" * 60)
    print("Eval Report")
    print("=" * 60)
    print(f"Reviewed:     {reviewed_count}")
    print(f"Unreviewed:   {unreviewed_count} (skipped)")
    if missing_image_count:
        print(f"Missing images: {missing_image_count}")
    print()

    if reviewed_count == 0:
        print("No reviewed labels — nothing to score.")
        return

    total = sum(type_total.values())
    correct = sum(type_correct.values())
    print(f"Type accuracy: {pct(correct, total)}")
    for tname in sorted(type_total):
        print(f"  {tname:12} {pct(type_correct[tname], type_total[tname])}")
    print()

    if field_total:
        all_field_total = sum(field_total.values())
        all_field_correct = sum(field_correct.values())
        print(f"Field accuracy (overall): {pct(all_field_correct, all_field_total)}")
        for field in sorted(field_total, key=lambda f: field_correct[f] / field_total[f]):
            print(f"  {field:20} {pct(field_correct[field], field_total[field])}")
        print()

    if failures:
        print(f"Failures ({len(failures)}):")
        for line in failures:
            print(f"  {line}")
        print()

    current = write_snapshot(type_total, type_correct, field_total, field_correct)

    baseline_path = EVAL_DIR / "baseline.json"
    if baseline_path.exists():
        baseline = json.loads(baseline_path.read_text())
        print_delta(current, baseline)


if __name__ == "__main__":
    main()
