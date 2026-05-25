from __future__ import annotations

from rapidfuzz.distance import Levenshtein

from .fuzzy_match import passes_threshold
from .id_type import IdType
from .ocr_item import OcrItem


class DetermineIdType:
    SIM_HEADER_LABELS = frozenset(
        {"SURAT IZIN MENGEMUDI", "DRIVING LICENSE", "INDONESIA"}
    )

    def execute(
        self,
        items: list[OcrItem],
        label_dictionary: dict[str, IdType],
    ) -> IdType:
        votes: dict[str, int] = {}
        saw_sim_header = False
        labels = list(label_dictionary.keys())

        for item in items:
            matched_label = self._match_label(item.text, labels)

            if matched_label is None:
                continue

            if matched_label in self.SIM_HEADER_LABELS:
                saw_sim_header = True
                continue

            type_value = label_dictionary[matched_label].value
            votes[type_value] = votes.get(type_value, 0) + 1

        if not votes:
            return IdType.SIM_MODERN if saw_sim_header else IdType.KTP

        max_count = max(votes.values())

        for key, value in votes.items():
            if value == max_count:
                return IdType(key)

        return IdType.KTP

    def _match_label(self, text: str, labels: list[str]) -> str | None:
        text = text.strip()

        if not text:
            return None

        if text in labels:
            return text

        fuzzy = self._fuzzy_match(text, labels)
        if fuzzy is not None:
            return fuzzy

        return self._prefix_match(text, labels)

    def _fuzzy_match(self, text: str, labels: list[str]) -> str | None:
        best_label = None
        best_distance = float("inf")
        text_lower = text.lower()

        for label in labels:
            distance = Levenshtein.distance(text_lower, label.lower())

            if distance < best_distance:
                best_distance = distance
                best_label = label

        if best_label is None:
            return None

        if passes_threshold(best_distance, len(text), len(best_label)):
            return best_label

        return None

    def _prefix_match(self, text: str, labels: list[str]) -> str | None:
        best_label = None
        best_len = 0

        for label in labels:
            label_len = len(label)
            if label_len <= 3 or label_len >= len(text):
                continue

            prefix = text[:label_len]
            distance = Levenshtein.distance(prefix.lower(), label.lower())

            if passes_threshold(distance, len(prefix), label_len) and label_len > best_len:
                best_label = label
                best_len = label_len

        return best_label
