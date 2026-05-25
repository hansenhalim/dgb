from __future__ import annotations

from enum import Enum


class IdType(str, Enum):
    KTP = "KTP"
    SIM_MODERN = "SIM_MODERN"
    SIM_SIX_LINE = "SIM_6_LINE"
    SIM_OLD = "SIM_OLD"

    def fields(self) -> list[str]:
        if self is IdType.KTP:
            return [
                "nik",
                "nama",
                "tempat_lahir",
                "tanggal_lahir",
                "jenis_kelamin",
                "golongan_darah",
                "alamat",
                "rt",
                "rw",
                "kelurahan",
                "kecamatan",
                "agama",
                "status_perkawinan",
                "pekerjaan",
                "kewarganegaraan",
                "berlaku_hingga",
                "provinsi",
                "kota",
            ]
        return [
            "nomor_sim",
            "nama",
            "tempat_lahir",
            "tanggal_lahir",
            "golongan_darah",
            "jenis_kelamin",
            "alamat",
            "pekerjaan",
            "tempat_pembuatan",
            "jenis_sim",
            "tanggal_berlaku",
        ]
