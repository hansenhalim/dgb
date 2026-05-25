from __future__ import annotations

import re
from functools import cmp_to_key

from .id_type import IdType
from .ocr_item import OcrItem


class ExtractFields:
    SIM_MODERN_FIELD_MAP: dict[str, list[str]] = {
        "Nama/Name": ["nama"],
        "Tempat, Tgl Lahir/Place": ["tempat_lahir", "tanggal_lahir"],
        "Gol Darah/Blood type": ["golongan_darah"],
        "Jenis Kelamin/Sex": ["jenis_kelamin"],
        "Alamat/Address": ["alamat"],
        "Pekerjaan/Occupation": ["pekerjaan"],
        "Diterbitkan Oleh/Issued By": ["tempat_pembuatan"],
    }

    SIM_SIX_LINE_MAP: dict[str, list[str]] = {
        "1.": ["nama"],
        "2.": ["tempat_lahir", "tanggal_lahir"],
        "3.": ["golongan_darah", "jenis_kelamin"],
        "4.": ["alamat"],
        "5.": ["pekerjaan"],
        "6.": ["tempat_pembuatan"],
    }

    SIM_OLD_FIELD_MAP: dict[str, list[str]] = {
        "Nama": ["nama"],
        "Alamat": ["alamat"],
        "Tempat &": ["tempat_lahir"],
        "Tgl.Lahir": ["tanggal_lahir"],
        "Tinggi": [],
        "Pekerjaan": ["pekerjaan"],
        "No. SIM": ["nomor_sim"],
        "Berlaku s/d": ["tanggal_berlaku"],
    }

    MULTI_LINE_LABELS = [
        "Nama",
        "Tempat/Tgl Lahir",
        "Alamat",
        "Alamat/Address",
        "4.",
    ]

    SIM_OLD_MULTI_LINE_LABELS = ["Alamat"]

    def execute(
        self,
        items: list[OcrItem],
        id_type: IdType,
        label_dictionary: dict[str, IdType],
    ) -> dict[str, str | None]:
        if id_type is IdType.KTP:
            return self._extract_ktp(items, label_dictionary)
        if id_type is IdType.SIM_MODERN:
            return self._extract_sim_modern(items, label_dictionary)
        if id_type is IdType.SIM_SIX_LINE:
            return self._extract_sim_six_line(items)
        if id_type is IdType.SIM_OLD:
            return self._extract_sim_old(items)
        return self._extract_sim_modern(items, label_dictionary)

    def _extract_ktp(
        self,
        items: list[OcrItem],
        label_dictionary: dict[str, IdType],
    ) -> dict[str, str | None]:
        from .spatial_extractor import extract_ktp

        provinsi, kota = self._extract_ktp_header(items)
        filtered_items = self._exclude_stamp_items(items)
        fields = extract_ktp(filtered_items)
        fields["provinsi"] = provinsi
        fields["kota"] = kota
        return fields

    def _extract_ktp_header(
        self,
        items: list[OcrItem],
    ) -> tuple[str | None, str | None]:
        top_items = sorted(items, key=lambda i: i.top())[:5]

        provinsi: str | None = None
        kota: str | None = None

        for item in top_items:
            upper = item.text.upper()

            if provinsi is None and "PROVINSI" in upper:
                provinsi = re.sub(r"^PROVINSI\s*", "", upper, flags=re.IGNORECASE).strip()
            elif kota is None and (upper.startswith("KOTA") or upper.startswith("KABUPATEN")):
                kota = re.sub(r"^(KOTA|KABUPATEN)(?!\s)", r"\1 ", upper)

        return (provinsi or None, kota or None)

    def _exclude_stamp_items(self, items: list[OcrItem]) -> list[OcrItem]:
        if len(items) < 5:
            return items

        all_tops = [i.top() for i in items]
        bottom_threshold = min(all_tops) + (max(all_tops) - min(all_tops)) * 0.65

        right_positions = sorted(i.right() for i in items)
        median_right = right_positions[int(len(right_positions) * 0.5)]

        return [
            item for item in items
            if not (item.top() >= bottom_threshold and item.left() > median_right)
        ]

    def _extract_sim_modern(
        self,
        items: list[OcrItem],
        label_dictionary: dict[str, IdType],
    ) -> dict[str, str | None]:
        from .spatial_extractor import extract_sim_modern

        fields = extract_sim_modern(items)
        fields["nomor_sim"] = self._extract_sim_number(items)
        fields["jenis_sim"] = self._extract_sim_type(items)
        fields["tanggal_berlaku"] = self._extract_date_from_bottom(items)
        return fields

    def _extract_sim_six_line(
        self,
        items: list[OcrItem],
    ) -> dict[str, str | None]:
        from .spatial_extractor import extract_sim_six_line

        fields = extract_sim_six_line(items)
        fields["nomor_sim"] = self._extract_sim_number(items)
        fields["jenis_sim"] = self._extract_sim_type(items)
        fields["tanggal_berlaku"] = self._extract_date_from_bottom(items)
        return fields

    def _extract_sim_old(
        self,
        items: list[OcrItem],
    ) -> dict[str, str | None]:
        from .spatial_extractor import extract_sim_old

        fields = extract_sim_old(items)
        fields["golongan_darah"] = None
        fields["jenis_kelamin"] = self._extract_sim_old_sex(items)
        fields["tempat_pembuatan"] = self._extract_sim_old_tempat_pembuatan(items)
        fields["jenis_sim"] = self._extract_sim_type(items)
        if not fields.get("nomor_sim"):
            fields["nomor_sim"] = self._extract_sim_number(items)
        if not fields.get("tanggal_berlaku"):
            fields["tanggal_berlaku"] = self._extract_date_from_bottom(items)
        return fields

    def _pair_sim_old_labels(
        self,
        items: list[OcrItem],
    ) -> dict[str, str | None]:
        label_set = list(self.SIM_OLD_FIELD_MAP.keys())
        label_items: list[OcrItem] = []
        non_label_items: list[OcrItem] = []

        for item in items:
            if item.text in label_set:
                label_items.append(item)
            else:
                non_label_items.append(item)

        label_items.sort(key=lambda i: i.center_y())

        pairs: dict[str, str | None] = {}
        used_items: set[int] = set()

        for i, label in enumerate(label_items):
            next_label_y = label_items[i + 1].top() if i + 1 < len(label_items) else float("inf")
            is_multi_line = label.text in self.SIM_OLD_MULTI_LINE_LABELS

            row_candidates = self._find_row_candidates(label, non_label_items, used_items, label_items)

            for candidate in row_candidates:
                used_items.add(id(candidate))

            value = " ".join(c.text for c in row_candidates)

            if is_multi_line:
                below_candidates = self._find_below_candidates(
                    label, row_candidates, non_label_items, next_label_y, used_items,
                )

                for candidate in below_candidates:
                    used_items.add(id(candidate))

                if below_candidates:
                    below_text = " ".join(c.text for c in below_candidates)
                    value = (value + " " + below_text).strip()

            pairs[label.text] = value if value != "" else None

        return pairs

    def _extract_sim_old_sex(self, items: list[OcrItem]) -> str | None:
        for item in items:
            upper = item.text.strip().upper()
            if upper == "PRIA" or upper == "WANITA":
                return upper
        return None

    def _extract_sim_old_tempat_pembuatan(
        self,
        items: list[OcrItem],
    ) -> str | None:
        issue_row: OcrItem | None = None

        for item in items:
            if re.match(r"^[A-Z][A-Z\s]+,\s*\d{2}-\d{2}-\d{4}", item.text.strip()):
                if issue_row is None or item.top() > issue_row.top():
                    issue_row = item

        if issue_row is None:
            return None

        issue_center_y = issue_row.center_y()
        below = [
            i for i in items
            if i.center_y() > issue_center_y + (issue_row.height() * 0.3)
        ]

        if not below:
            return None

        below.sort(key=lambda i: i.top())

        first = below[0]
        threshold = max(first.height() * 0.7, 5.0)
        first_y = first.center_y()

        row_items = [i for i in below if abs(i.center_y() - first_y) < threshold]
        row_items.sort(key=lambda i: i.left())

        text = " ".join(i.text for i in row_items)

        if re.search(r"\b(NRP|KOMBES|AKBP|KOMISARIS|BRIGADIR|S\.IK)\b", text, re.IGNORECASE):
            return None

        return text if text != "" else None

    def _extract_date_string(self, value: str | None) -> str | None:
        if value is None:
            return None

        m = re.search(r"\d{2}-\d{2}-\d{4}", value)
        if m:
            return m.group(0)

        digits = re.sub(r"\D", "", value)
        return self._parse_date(digits)

    def _pair_labels_with_below_values(
        self,
        items: list[OcrItem],
        label_dictionary: dict[str, IdType],
        target_type: IdType,
        field_map: dict[str, list[str]],
    ) -> dict[str, str | None]:
        label_items: list[OcrItem] = []
        non_label_items: list[OcrItem] = []

        for item in items:
            if (
                item.text in field_map
                and item.text in label_dictionary
                and label_dictionary[item.text] is target_type
            ):
                label_items.append(item)
            else:
                non_label_items.append(item)

        label_items.sort(key=lambda i: i.center_y())

        pairs: dict[str, str | None] = {}
        used_items: set[int] = set()

        for i, label in enumerate(label_items):
            next_label_y = self._find_next_label_y_below(label, label_items, i)
            is_multi_line = label.text in self.MULTI_LINE_LABELS

            below_candidates = self._find_directly_below_candidates(
                label, non_label_items, next_label_y, used_items, is_multi_line,
            )

            for candidate in below_candidates:
                used_items.add(id(candidate))

            value = " ".join(c.text for c in below_candidates)
            pairs[label.text] = value if value != "" else None

        return pairs

    def _find_next_label_y_below(
        self,
        current_label: OcrItem,
        sorted_labels: list[OcrItem],
        current_index: int,
    ) -> float:
        for j in range(current_index + 1, len(sorted_labels)):
            candidate = sorted_labels[j]
            is_same_row = abs(candidate.center_y() - current_label.center_y()) < current_label.height() * 0.7

            if not is_same_row:
                return candidate.top()

        return float("inf")

    def _find_directly_below_candidates(
        self,
        label: OcrItem,
        all_items: list[OcrItem],
        next_label_y: float,
        used_items: set[int],
        is_multi_line: bool,
    ) -> list[OcrItem]:
        candidates: list[OcrItem] = []

        for item in all_items:
            if id(item) in used_items:
                continue

            is_below_label = item.top() >= label.bottom() - (label.height() * 0.5)
            is_above_next_label = item.center_y() < next_label_y
            is_left_aligned = abs(item.left() - label.left()) < (label.width() * 0.5)

            if is_below_label and is_above_next_label and is_left_aligned:
                candidates.append(item)

        candidates.sort(key=lambda i: i.top())

        if not is_multi_line and candidates:
            first_y = candidates[0].center_y()
            candidates = [c for c in candidates if abs(c.center_y() - first_y) < c.height() * 0.7]

        return candidates

    def _pair_numbered_lines(
        self,
        items: list[OcrItem],
    ) -> tuple[dict[str, str | None], set[int]]:
        numbered_labels: list[OcrItem] = []
        non_label_items: list[OcrItem] = []

        for item in items:
            if re.match(r"^[1-6]\.$", item.text):
                numbered_labels.append(item)
            else:
                non_label_items.append(item)

        numbered_labels.sort(key=lambda i: i.center_y())

        has_label_5 = any(i.text == "5." for i in numbered_labels)

        pairs: dict[str, str | None] = {}
        used_items: set[int] = set()

        for i, label in enumerate(numbered_labels):
            used_items.add(id(label))

            next_label_y = numbered_labels[i + 1].top() if i + 1 < len(numbered_labels) else float("inf")
            is_multi_line = label.text == "4."

            row_candidates = self._find_row_candidates(label, non_label_items, used_items, numbered_labels)

            for candidate in row_candidates:
                used_items.add(id(candidate))

            value = " ".join(c.text for c in row_candidates)

            if is_multi_line:
                below_candidates = self._find_below_candidates(
                    label, row_candidates, non_label_items, next_label_y, used_items,
                )

                if not has_label_5 and below_candidates:
                    below_candidates = self._exclude_last_row(below_candidates)

                for candidate in below_candidates:
                    used_items.add(id(candidate))

                if below_candidates:
                    below_text = " ".join(c.text for c in below_candidates)
                    value = (value + " " + below_text).strip()

            pairs[label.text] = value if value != "" else None

        return pairs, used_items

    def _exclude_last_row(self, candidates: list[OcrItem]) -> list[OcrItem]:
        if not candidates:
            return []

        last = candidates[-1]
        last_y = last.center_y()
        threshold = last.height() * 0.7

        return [c for c in candidates if abs(c.center_y() - last_y) > threshold]

    def _fill_missing_sim_lines(
        self,
        items: list[OcrItem],
        pairs: dict[str, str | None],
        used_item_ids: set[int],
    ) -> dict[str, str | None]:
        missing_lines: list[int] = []
        for n in range(1, 7):
            if f"{n}." not in pairs:
                missing_lines.append(n)

        if not missing_lines:
            return pairs

        unclaimed_items = self._collect_unclaimed_items(items, used_item_ids)

        if not unclaimed_items:
            return pairs

        def _y_then_x(a: OcrItem, b: OcrItem) -> int:
            y_diff = a.top() - b.top()
            if abs(y_diff) > 5:
                return -1 if y_diff < 0 else (1 if y_diff > 0 else 0)
            left_diff = a.left() - b.left()
            return -1 if left_diff < 0 else (1 if left_diff > 0 else 0)

        unclaimed_items.sort(key=cmp_to_key(_y_then_x))

        if 1 in missing_lines and unclaimed_items:
            name_items = self._take_first_row(unclaimed_items)
            if name_items:
                pairs["1."] = " ".join(c.text for c in name_items)
                unclaimed_items = self._remove_items(unclaimed_items, name_items)

        if 2 in missing_lines and unclaimed_items:
            birth_item = self._find_item_with_date(unclaimed_items)
            if birth_item is not None:
                pairs["2."] = birth_item.text
                unclaimed_items = self._remove_items(unclaimed_items, [birth_item])

        if 3 in missing_lines and unclaimed_items:
            sex_item = self._find_item_with_sex(unclaimed_items)
            if sex_item is not None:
                pairs["3."] = sex_item.text
                unclaimed_items = self._remove_items(unclaimed_items, [sex_item])

        if 6 in missing_lines and unclaimed_items:
            office_items = self._take_last_row(unclaimed_items)
            if office_items:
                pairs["6."] = " ".join(c.text for c in office_items)
                unclaimed_items = self._remove_items(unclaimed_items, office_items)

        miss_4 = 4 in missing_lines
        miss_5 = 5 in missing_lines

        if (miss_4 or miss_5) and unclaimed_items:
            if miss_4 and miss_5:
                address_items, job_items = self._split_address_and_occupation(unclaimed_items)
                if address_items:
                    pairs["4."] = " ".join(c.text for c in address_items)
                if job_items:
                    pairs["5."] = " ".join(c.text for c in job_items)
            elif miss_4:
                value = " ".join(c.text for c in unclaimed_items)
                pairs["4."] = value if value != "" else None
            elif miss_5:
                value = " ".join(c.text for c in unclaimed_items)
                pairs["5."] = value if value != "" else None

        return pairs

    def _collect_unclaimed_items(
        self,
        items: list[OcrItem],
        used_item_ids: set[int],
    ) -> list[OcrItem]:
        sim_number_bottom: float = 0

        for item in items:
            cleaned = re.sub(r"[\s-]", "", item.text)
            if re.match(r"^\d{10,20}$", cleaned):
                sim_number_bottom = item.bottom()
                break

        unclaimed: list[OcrItem] = []

        for item in items:
            if id(item) in used_item_ids:
                continue

            text = item.text.strip()
            upper = text.upper()

            if re.match(r"^[1-6]\.$", text):
                continue

            cleaned = re.sub(r"[\s-]", "", text)
            if re.match(r"^\d{10,20}$", cleaned):
                continue

            if re.match(r"^\d{2}-\d{2}-\d{4}$", text):
                continue

            if sim_number_bottom > 0 and item.bottom() <= sim_number_bottom:
                continue

            if upper in ("INDONESIA", "SURAT IZIN MENGEMUDI") or "DRIVING" in upper:
                continue

            if len(text) <= 1:
                continue

            unclaimed.append(item)

        return unclaimed

    def _take_first_row(self, items: list[OcrItem]) -> list[OcrItem]:
        if not items:
            return []

        first_y = items[0].center_y()
        threshold = items[0].height() * 0.7

        return [i for i in items if abs(i.center_y() - first_y) < threshold]

    def _take_last_row(self, items: list[OcrItem]) -> list[OcrItem]:
        if not items:
            return []

        last = items[-1]
        last_y = last.center_y()
        threshold = last.height() * 0.7

        return [i for i in items if abs(i.center_y() - last_y) < threshold]

    def _find_item_with_date(self, items: list[OcrItem]) -> OcrItem | None:
        for item in items:
            if re.search(r"\d{2}-\d{2}-\d{4}", item.text):
                return item
        return None

    def _find_item_with_sex(self, items: list[OcrItem]) -> OcrItem | None:
        for item in items:
            upper = item.text.upper()
            if "PRIA" in upper or "WANITA" in upper:
                return item
        return None

    def _split_address_and_occupation(
        self,
        items: list[OcrItem],
    ) -> tuple[list[OcrItem], list[OcrItem]]:
        if len(items) <= 1:
            return items, []

        last = items[-1]
        last_y = last.center_y()
        threshold = last.height() * 0.7

        address_items: list[OcrItem] = []
        job_items: list[OcrItem] = []

        for item in items:
            if abs(item.center_y() - last_y) < threshold:
                job_items.append(item)
            else:
                address_items.append(item)

        return address_items, job_items

    def _remove_items(
        self,
        items: list[OcrItem],
        to_remove: list[OcrItem],
    ) -> list[OcrItem]:
        remove_ids = {id(i) for i in to_remove}
        return [i for i in items if id(i) not in remove_ids]

    def _find_row_candidates(
        self,
        label: OcrItem,
        all_items: list[OcrItem],
        used_items: set[int],
        all_labels: list[OcrItem],
    ) -> list[OcrItem]:
        tolerance = label.height() * 0.8
        candidates: list[OcrItem] = []

        for item in all_items:
            if id(item) in used_items:
                continue

            is_right_of = item.left() > (label.right() - tolerance)
            is_same_row = abs(item.center_y() - label.center_y()) < (label.height() * 0.7)

            if is_right_of and is_same_row and self._is_closest_label(item, label, all_labels):
                candidates.append(item)

        candidates.sort(key=lambda i: i.left())

        filtered: list[OcrItem] = []
        last_right = label.right()
        initial_gap: float | None = None

        for candidate in candidates:
            gap = candidate.left() - last_right

            if initial_gap is None:
                max_gap = label.height() * 10
                initial_gap = gap
            else:
                max_gap = max(initial_gap, label.height() * 2)

            if gap > max_gap:
                break

            filtered.append(candidate)
            last_right = candidate.right()

        return filtered

    def _is_closest_label(
        self,
        candidate: OcrItem,
        current_label: OcrItem,
        all_labels: list[OcrItem],
    ) -> bool:
        if not all_labels:
            return True

        current_distance = abs(candidate.center_y() - current_label.center_y())

        for other_label in all_labels:
            if id(other_label) == id(current_label):
                continue

            if other_label.left() >= candidate.left():
                continue

            other_distance = abs(candidate.center_y() - other_label.center_y())

            if other_distance < current_distance:
                return False

        return True

    def _find_below_candidates(
        self,
        label: OcrItem,
        row_candidates: list[OcrItem],
        all_items: list[OcrItem],
        next_label_y: float,
        used_items: set[int],
    ) -> list[OcrItem]:
        if row_candidates:
            reference_left = min(c.left() for c in row_candidates)
        else:
            reference_left = label.right()

        candidates: list[OcrItem] = []

        for item in all_items:
            if id(item) in used_items:
                continue

            is_below_label = item.top() > label.bottom() - (label.height() * 0.3)
            is_above_next_label = item.center_y() < next_label_y
            is_aligned = item.left() >= (reference_left - reference_left * 0.2)

            if is_below_label and is_above_next_label and is_aligned:
                candidates.append(item)

        def _y_then_x(a: OcrItem, b: OcrItem) -> int:
            y_diff = a.top() - b.top()
            if abs(y_diff) > 5:
                return -1 if y_diff < 0 else (1 if y_diff > 0 else 0)
            left_diff = a.left() - b.left()
            return -1 if left_diff < 0 else (1 if left_diff > 0 else 0)

        candidates.sort(key=cmp_to_key(_y_then_x))

        return candidates

    def _split_tempat_tanggal_lahir(
        self,
        value: str,
    ) -> tuple[str | None, str | None]:
        m = re.search(r"\d", value)
        if m:
            place = value[:m.start()].rstrip(" ,.\t")
            place = self._clean_place_name(place)
            raw_date = value[m.start():]

            date = self._parse_date(re.sub(r"\D", "", raw_date))

            return (place if place != "" else None, date)

        return (value, None)

    def _parse_date(self, digits: str) -> str | None:
        if len(digits) != 8:
            return None

        return f"{digits[0:2]}-{digits[2:4]}-{digits[4:8]}"

    def _clean_place_name(self, place: str) -> str:
        return re.sub(r"^[^a-zA-Z]+", "", place)

    def _split_rt_rw(self, value: str) -> tuple[str | None, str | None]:
        if "/" in value:
            parts = value.split("/", 1)
            return (parts[0].strip(), parts[1].strip())

        digits_only = re.sub(r"\D", "", value)

        if digits_only and len(digits_only) >= 6:
            return (digits_only[:3], digits_only[-3:])

        if digits_only and len(digits_only) >= 3:
            return (digits_only[:3], None)

        return (value, None)

    def _split_gol_darah_jenis_kelamin(
        self,
        value: str,
    ) -> tuple[str | None, str | None]:
        parts = re.split(r"[\s-]+", value, maxsplit=1)

        if len(parts) < 2:
            return (value, None)

        first_part = parts[0].strip()
        second_part = parts[1].strip()

        blood_types = ["A", "B", "AB", "O", "-"]
        if first_part.upper() in blood_types:
            return (first_part.upper(), second_part)

        return (first_part, second_part)

    def _extract_sim_number(self, items: list[OcrItem]) -> str | None:
        import math

        top_count = int(math.ceil(len(items) * 0.4))
        top_items = sorted(items, key=lambda i: i.top())[:top_count]

        for item in top_items:
            cleaned = re.sub(r"[\s-]", "", item.text)
            if re.match(r"^\d{10,20}$", cleaned):
                return item.text

        for item in items:
            if re.match(r"^\d{4}-\d{4}-\d{6,}$", item.text):
                return item.text

        for item in items:
            cleaned = re.sub(r"[\s-]", "", item.text)
            if re.match(r"^\d{10,20}$", cleaned):
                return item.text

        return None

    SIM_CLASS_CANONICAL = {
        "A": "A",
        "B1": "B1",
        "B2": "B2",
        "BI": "BI",
        "BII": "BII",
        "C": "C",
        "D": "D",
    }

    def _extract_sim_type(self, items: list[OcrItem]) -> str | None:
        type_item: OcrItem | None = None
        canonical: str | None = None

        for item in items:
            c = self._normalize_sim_class(item.text.strip())
            if c is not None:
                type_item = item
                canonical = c
                break

        if canonical is None or type_item is None:
            return None

        for item in items:
            if item is type_item:
                continue
            if item.text.strip().upper() != "UMUM":
                continue
            y_diff = item.center_y() - type_item.center_y()
            if y_diff < -type_item.height() * 0.7 or y_diff > type_item.height() * 2:
                continue
            if item.center_x() <= type_item.center_x():
                continue
            return f"{canonical} UMUM"

        return canonical

    def _normalize_sim_class(self, text: str) -> str | None:
        upper = text.upper()
        if upper in self.SIM_CLASS_CANONICAL:
            return self.SIM_CLASS_CANONICAL[upper]
        if upper.startswith("B"):
            replaced = upper.replace("L", "I")
            if replaced in self.SIM_CLASS_CANONICAL:
                return self.SIM_CLASS_CANONICAL[replaced]
        return None

    def _extract_date_from_bottom(self, items: list[OcrItem]) -> str | None:
        sorted_items = sorted(items, key=lambda i: i.top(), reverse=True)[:5]

        for item in sorted_items:
            m = re.search(r"\d{2}-\d{2}-\d{4}", item.text)
            if m:
                return m.group(0)

        return None
