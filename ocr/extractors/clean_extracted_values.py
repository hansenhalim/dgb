from __future__ import annotations

import re

from rapidfuzz.distance import Levenshtein


class CleanExtractedValues:
    VALUE_DICTIONARY: dict[str, list[str]] = {
        "status_perkawinan": [
            "BELUM KAWIN",
            "KAWIN",
            "CERAI HIDUP",
            "CERAI MATI",
            "UNMARRIED",
            "MARRIED",
            "DIVORCE",
        ],
        "jenis_kelamin": [
            "LAKI-LAKI",
            "PEREMPUAN",
            "PRIA",
            "WANITA",
            "MALE",
            "FEMALE",
        ],
        "agama": [
            "ISLAM",
            "KRISTEN",
            "KATHOLIK",
            "HINDU",
            "BUDDHA",
            "KONGHUCU",
            "CHRISTIAN",
            "CATHOLIC",
            "CONFUSION",
        ],
        "golongan_darah": [
            "A",
            "B",
            "AB",
            "O",
            "-",
        ],
        "pekerjaan": [
            "BELUM/TIDAK BEKERJA",
            "PEGAWAI NEGERI SIPIL (PNS)",
            "MENGURUS RUMAH TANGGA",
            "PELAJAR/MAHASISWA",
            "WIRASWASTA",
            "KARYAWAN BUMN",
            "KARYAWAN SWASTA",
            "DOSEN",
            "BURUH HARIAN LEPAS",
            "SOPIR",
            "PELAUT",
            "OTHERS",
        ],
        "kewarganegaraan": [
            "WNI",
            "CHINA",
        ],
        "berlaku_hingga": [
            "SEUMUR HIDUP",
        ],
    }

    def execute(
        self,
        fields: dict[str, str | None],
    ) -> dict[str, str | None]:
        result: dict[str, str | None] = {}

        for key, value in fields.items():
            if value is None or value == "":
                if key == "golongan_darah":
                    result[key] = "-"
                else:
                    result[key] = None
                continue

            value = value.lstrip("：: \t\n\r\0\x0b")
            value = value.strip().upper()

            if re.match(r"^[\.\,\-\s]+$", value):
                result[key] = None
                continue

            if key == "nik":
                result[key] = self._correct_nik(value)
            elif key == "kelurahan" or key == "kecamatan":
                cleaned = re.sub(r"[^A-Z\s]", "", value).strip()
                result[key] = cleaned if cleaned else None
            elif key == "tempat_lahir":
                cleaned = re.sub(r"[^A-Z\s]", "", value).strip()
                result[key] = cleaned if cleaned else None
            elif key == "golongan_darah":
                result[key] = self._correct_golongan_darah(value)
            elif key in self.VALUE_DICTIONARY:
                result[key] = self._correct_value(value, self.VALUE_DICTIONARY[key])
            else:
                result[key] = value

        return result

    def _correct_nik(self, value: str) -> str | None:
        ocr_map = {
            "O": "0",
            "Q": "0",
            "D": "0",
            "I": "1",
            "L": "1",
            "T": "1",
            "Z": "2",
            "S": "5",
            "G": "6",
            "B": "8",
        }

        cleaned = value.translate(str.maketrans(ocr_map))
        cleaned = re.sub(r"\D", "", cleaned)

        if len(cleaned) == 16:
            return cleaned

        return value

    def _correct_golongan_darah(self, value: str) -> str | None:
        cleaned = re.sub(r"[^A-Z0-9]", "", value)
        ocr_map = {"0": "O", "8": "B"}

        if cleaned in ocr_map:
            cleaned = ocr_map[cleaned]

        valid_values = self.VALUE_DICTIONARY["golongan_darah"]

        if cleaned in valid_values:
            return cleaned

        return "-"

    def _correct_value(self, value: str, valid_values: list[str]) -> str:
        if value in valid_values:
            return value

        for valid in valid_values:
            if value.startswith(valid) and len(value) > len(valid):
                char_after = value[len(valid) : len(valid) + 1]
                if char_after in (" ", ",", "."):
                    return valid

        best_match = None
        best_distance = float("inf")

        for valid in valid_values:
            distance = Levenshtein.distance(value, valid)

            if distance < best_distance:
                best_distance = distance
                best_match = valid

        if best_match is None:
            return value

        max_len = max(len(value), len(best_match))
        threshold = 0.5 if max_len <= 4 else 0.3

        if max_len > 0 and (best_distance / max_len) < threshold:
            return best_match

        return value
