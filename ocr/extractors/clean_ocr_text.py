from __future__ import annotations

import re

from rapidfuzz.distance import Levenshtein

from .fuzzy_match import passes_threshold
from .id_type import IdType
from .ocr_item import OcrItem


class CleanOcrText:
    def execute(
        self,
        items: list[OcrItem],
        label_dictionary: dict[str, IdType],
    ) -> list[OcrItem]:
        labels = list(label_dictionary.keys())
        result: list[OcrItem] = []

        for item in items:
            numbered_split = self._try_split_numbered_prefix(item)

            if numbered_split is not None:
                for split_item in numbered_split:
                    result.append(self._autocorrect_label(split_item, labels))
                continue

            split_items = self._try_split_merged_string(item, labels)

            for split_item in split_items:
                result.append(self._autocorrect_label(split_item, labels))

        return result

    def _try_split_numbered_prefix(self, item: OcrItem) -> list[OcrItem] | None:
        text = item.text

        m = re.match(r"^([1-6]\.\s*)(.+)$", text, re.DOTALL)
        if m:
            left_part = m.group(1)
            value = m.group(2).strip()
            label = left_part[:2]
            if value:
                return self._build_split_items(item, label, left_part, value)

        m = re.match(r"^(\.\s*)([A-Z].+)$", text)
        if m:
            left_part = m.group(1)
            value = m.group(2).strip()
            if value:
                return self._build_split_items(item, "1.", left_part, value)

        return None

    def _try_split_merged_string(
        self,
        item: OcrItem,
        labels: list[str],
    ) -> list[OcrItem]:
        separators = ["： ", "：", ": ", ":"]

        for separator in separators:
            pos = item.text.find(separator)

            if pos == -1 or pos < 2:
                continue

            left_part = item.text[:pos]
            right_part = item.text[pos + len(separator):].strip()

            if not right_part:
                continue

            matched = self._find_best_label_match(left_part, labels)

            if matched is None:
                continue

            return self._build_split_items(item, matched, left_part, right_part)

        space_split = self._try_split_on_label_prefix(item, labels)
        if space_split is not None:
            return space_split

        trailing_split = self._try_split_by_trailing_value(item, labels)
        if trailing_split is not None:
            return trailing_split

        return [item]

    def _try_split_on_label_prefix(
        self,
        item: OcrItem,
        labels: list[str],
    ) -> list[OcrItem] | None:
        text = item.text
        best_match = None
        best_match_len = 0

        for label in labels:
            label_len = len(label)
            if label_len <= 3 or label_len >= len(text):
                continue

            prefix = text[:label_len]
            char_after = text[label_len:label_len + 1]

            distance = Levenshtein.distance(prefix.lower(), label.lower())

            has_separator = char_after in (" ", ",", ".")
            is_camelcase_boundary = (
                distance == 0 and (char_after.isupper() or char_after.isdigit())
            )

            if not (has_separator or is_camelcase_boundary):
                continue

            if passes_threshold(distance, len(prefix), label_len) and label_len > best_match_len:
                best_match = label
                best_match_len = label_len

        if best_match is None:
            return None

        right_part = text[best_match_len:].strip()

        if not right_part:
            return None

        return self._build_split_items(item, best_match, text[:best_match_len], right_part)

    def _try_split_by_trailing_value(
        self,
        item: OcrItem,
        labels: list[str],
    ) -> list[OcrItem] | None:
        text = item.text
        text_len = len(text)

        if text_len < 5:
            return None

        if self._find_best_label_match(text, labels) is not None:
            return None

        for trim in range(1, min(3, text_len - 4) + 1):
            prefix = text[:text_len - trim]
            suffix = text[text_len - trim:]

            matched = self._find_best_label_match(prefix, labels)

            if matched is not None and len(matched) > 3:
                return self._build_split_items(item, matched, prefix, suffix)

        return None

    def _build_split_items(
        self,
        item: OcrItem,
        matched_label: str,
        left_part: str,
        right_part: str,
    ) -> list[OcrItem]:
        total_len = len(item.text)
        split_ratio = len(left_part) / max(total_len, 1)

        left_poly = self._split_poly_left(item.rec_poly, split_ratio)
        right_poly = self._split_poly_right(item.rec_poly, split_ratio)

        return [
            OcrItem(matched_label, left_poly),
            OcrItem(right_part, right_poly),
        ]

    def _autocorrect_label(self, item: OcrItem, labels: list[str]) -> OcrItem:
        matched = self._find_best_label_match(item.text, labels)

        if matched is not None:
            return item.with_text(matched)

        return item

    def _find_best_label_match(self, text: str, labels: list[str]) -> str | None:
        text = text.strip()

        if not text:
            return None

        if text in labels:
            return text

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

    @staticmethod
    def _split_poly_left(
        poly: list[list[float]],
        ratio: float,
    ) -> list[list[float]]:
        left_x = poly[0][0]
        right_x = poly[1][0]
        split_x = int(left_x + (right_x - left_x) * ratio)

        return [
            [poly[0][0], poly[0][1]],
            [split_x, poly[1][1]],
            [split_x, poly[2][1]],
            [poly[3][0], poly[3][1]],
        ]

    @staticmethod
    def _split_poly_right(
        poly: list[list[float]],
        ratio: float,
    ) -> list[list[float]]:
        left_x = poly[0][0]
        right_x = poly[1][0]
        split_x = int(left_x + (right_x - left_x) * ratio)

        return [
            [split_x, poly[0][1]],
            [poly[1][0], poly[1][1]],
            [poly[2][0], poly[2][1]],
            [split_x, poly[3][1]],
        ]
