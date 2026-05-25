from __future__ import annotations

from rapidfuzz.distance import Levenshtein


def best_label_match(text: str, labels: list[str]) -> str | None:
    text = text.strip()
    if not text:
        return None

    if text in labels:
        return text

    best_label: str | None = None
    best_distance: float = float("inf")
    text_lower = text.lower()

    for label in labels:
        distance = Levenshtein.distance(text_lower, label.lower())
        if distance < best_distance:
            best_distance = distance
            best_label = label

    if best_label is None:
        return None

    if passes_threshold(int(best_distance), len(text), len(best_label)):
        return best_label

    return None


def passes_threshold(distance: int, text_len: int, label_len: int) -> bool:
    max_len = max(text_len, label_len)

    if max_len <= 3:
        return distance <= 1

    if distance <= 1:
        return True

    if max_len >= 10:
        return (distance / max_len) < 0.2

    return False
