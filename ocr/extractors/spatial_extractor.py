"""Spatial-template-based field extractor for all ID types.

For each card, predicts field positions from a calibrated per-type template
anchored by detected label items. Falls back to data-driven scale when only
one anchor is found; returns all None when no anchors are found.

Per-region linear interpolation between adjacent detected anchors gives more
accurate predictions than a single global affine transform.
"""
from __future__ import annotations

import re
import statistics

from . import spatial_template as st
from .ocr_item import OcrItem

Y_TOLERANCE_LINES = 0.4
X_TOLERANCE_UNITS = 0.5

DATE_RE = re.compile(r"\d{2}-\d{2}-\d{4}")
NIK_RE = re.compile(r"\d{16}")
RT_RW_RE = re.compile(r"\d{1,3}\s*/\s*\d{1,3}")
BLOOD_RE = re.compile(r"^[ABO0\-]{1,2}$")


def _v_nik(s: str) -> bool:
    return bool(NIK_RE.search(re.sub(r"\D", "", s)))


def _v_date(s: str) -> bool:
    return bool(DATE_RE.search(s))


def _v_rt_rw(s: str) -> bool:
    return bool(RT_RW_RE.search(s.strip()))


def _v_blood(s: str) -> bool:
    cleaned = re.sub(r"[^A-Z0-9\-]", "", s.strip().upper())
    return bool(BLOOD_RE.fullmatch(cleaned))


def _v_sex(s: str) -> bool:
    u = s.strip().upper()
    return "LAKI" in u or "PRIA" in u or "WANITA" in u or "PEREMPUAN" in u


def _v_tempat_tgl(s: str) -> bool:
    return bool(DATE_RE.search(s)) or bool(re.search(r"\d{6,8}", s))


def _v_berlaku_hingga(s: str) -> bool:
    u = s.strip().upper()
    return bool(DATE_RE.search(u)) or "SEUMUR" in u or "HIDUP" in u


def _v_free(s: str) -> bool:
    return bool(s.strip())


VALIDATORS = {
    "nik": _v_nik,
    "date": _v_date,
    "rt_rw": _v_rt_rw,
    "blood": _v_blood,
    "sex": _v_sex,
    "tempat_tgl": _v_tempat_tgl,
    "free": _v_free,
    "berlaku_hingga": _v_berlaku_hingga,
}


KTP_FIELD_NAMES = (
    "nik", "nama", "tempat_lahir", "tanggal_lahir", "jenis_kelamin",
    "golongan_darah", "alamat", "rt", "rw", "kelurahan", "kecamatan",
    "agama", "status_perkawinan", "pekerjaan", "kewarganegaraan", "berlaku_hingga",
)

SIM_FIELD_NAMES = (
    "nama", "tempat_lahir", "tanggal_lahir", "golongan_darah", "jenis_kelamin",
    "alamat", "pekerjaan", "tempat_pembuatan",
)

# Per-type config: (output_field_names, anchor_priority, anchor_offsets, fields, lines_per_baseline)
KTP_CONFIG = (
    KTP_FIELD_NAMES,
    st.KTP_ANCHOR_PRIORITY,
    st.KTP_ANCHOR_OFFSETS,
    st.KTP_FIELDS,
    12,
)

SIM_MODERN_CONFIG = (
    SIM_FIELD_NAMES,
    st.SIM_MODERN_ANCHOR_PRIORITY,
    st.SIM_MODERN_ANCHOR_OFFSETS,
    st.SIM_MODERN_FIELDS,
    6,
)

SIM_SIX_LINE_CONFIG = (
    SIM_FIELD_NAMES,
    st.SIM_SIX_LINE_ANCHOR_PRIORITY,
    st.SIM_SIX_LINE_ANCHOR_OFFSETS,
    st.SIM_SIX_LINE_FIELDS,
    4,
)

SIM_OLD_FIELD_NAMES = (
    "nama", "tempat_lahir", "tanggal_lahir", "pekerjaan", "alamat",
    "nomor_sim", "tanggal_berlaku",
)

SIM_OLD_CONFIG = (
    SIM_OLD_FIELD_NAMES,
    st.SIM_OLD_ANCHOR_PRIORITY,
    st.SIM_OLD_ANCHOR_OFFSETS,
    st.SIM_OLD_FIELDS,
    6,
)


def extract_ktp(items: list[OcrItem]) -> dict[str, str | None]:
    return _extract(items, KTP_CONFIG)


def extract_sim_modern(items: list[OcrItem]) -> dict[str, str | None]:
    return _extract(items, SIM_MODERN_CONFIG)


def extract_sim_six_line(items: list[OcrItem]) -> dict[str, str | None]:
    return _extract(items, SIM_SIX_LINE_CONFIG)


def extract_sim_old(items: list[OcrItem]) -> dict[str, str | None]:
    return _extract(items, SIM_OLD_CONFIG)


def _extract(items: list[OcrItem], config: tuple) -> dict[str, str | None]:
    field_names, anchor_priority, anchor_offsets, fields, lines_per_baseline = config
    output: dict[str, str | None] = {f: None for f in field_names}

    detected = _find_anchors(items, anchor_priority, anchor_offsets)
    if not detected:
        return output

    fallback = _global_scale(detected, items, lines_per_baseline)
    if fallback is None:
        return output

    anchor_item_ids = {id(item) for item, _, _ in detected}
    sorted_anchors = sorted(detected, key=lambda d: d[1])
    sorted_fields = sorted(fields.items(), key=lambda kv: kv[1]["y_offset"])

    for i, (field_name, cfg) in enumerate(sorted_fields):
        prediction = _predict_position(
            cfg["y_offset"], cfg["x_offset"], sorted_anchors, fallback,
        )
        if prediction is None:
            continue
        pred_y, pred_x, local_scale = prediction
        line_height_px = local_scale / lines_per_baseline
        y_tol = Y_TOLERANCE_LINES * line_height_px
        x_tol = X_TOLERANCE_UNITS * local_scale

        if cfg["multi_line"]:
            if i + 1 < len(sorted_fields):
                next_cfg = sorted_fields[i + 1][1]
                next_pred = _predict_position(
                    next_cfg["y_offset"], next_cfg["x_offset"], sorted_anchors, fallback,
                )
                next_pred_y = next_pred[0] if next_pred else pred_y + 3 * line_height_px
            else:
                next_pred_y = pred_y + 3 * line_height_px
            y_min = pred_y - y_tol
            y_max = next_pred_y - y_tol
        else:
            y_min = pred_y - y_tol
            y_max = pred_y + y_tol

        candidates = [
            it for it in items
            if id(it) not in anchor_item_ids
            and y_min <= it.center_y() <= y_max
            and abs(it.left() - pred_x) <= x_tol
        ]

        validator = VALIDATORS.get(cfg["validator"], _v_free)
        chosen = _pick_value(candidates, pred_y, pred_x, validator, cfg["multi_line"])
        if chosen is None:
            continue

        splits = cfg.get("splits_into")
        if splits == ["rt", "rw"]:
            rt, rw = _split_rt_rw(chosen)
            output["rt"] = rt
            output["rw"] = rw
        elif splits == ["tempat_lahir", "tanggal_lahir"]:
            tempat, tanggal = _split_tempat_tgl(chosen)
            output["tempat_lahir"] = tempat
            output["tanggal_lahir"] = tanggal
        elif splits == ["golongan_darah", "jenis_kelamin"]:
            blood, sex = _split_gol_sex(chosen)
            output["golongan_darah"] = blood
            output["jenis_kelamin"] = sex
        else:
            output[field_name] = chosen

    return output


def _find_anchors(
    items: list[OcrItem],
    anchor_priority: list[str],
    anchor_offsets: dict[str, dict],
) -> list[tuple[OcrItem, float, float]]:
    result: list[tuple[OcrItem, float, float]] = []
    used_labels: set[str] = set()
    for label in anchor_priority:
        if label in used_labels or label not in anchor_offsets:
            continue
        for it in items:
            if it.text == label:
                offsets = anchor_offsets[label]
                result.append((it, offsets["y_offset"], offsets["x_offset"]))
                used_labels.add(label)
                break
    return result


def _global_scale(
    detected: list[tuple[OcrItem, float, float]],
    items: list[OcrItem],
    lines_per_baseline: int,
) -> float | None:
    if len(detected) >= 2:
        by_calib = sorted(detected, key=lambda d: d[1])
        a_top = by_calib[0]
        a_bot = by_calib[-1]
        calib_dy = a_bot[1] - a_top[1]
        if calib_dy > 0:
            return (a_bot[0].center_y() - a_top[0].center_y()) / calib_dy
    anchor_y = detected[0][0].center_y()
    ys = sorted(it.center_y() for it in items if it.center_y() > anchor_y - 5)
    deltas = [ys[i + 1] - ys[i] for i in range(len(ys) - 1) if 5 < ys[i + 1] - ys[i] < 40]
    if len(deltas) < 3:
        return None
    return statistics.median(deltas) * lines_per_baseline


def _predict_position(
    field_calib_y: float,
    field_calib_x: float,
    sorted_anchors: list[tuple[OcrItem, float, float]],
    fallback_scale: float,
) -> tuple[float, float, float] | None:
    if not sorted_anchors:
        return None

    below: tuple[OcrItem, float, float] | None = None
    above: tuple[OcrItem, float, float] | None = None
    for a in sorted_anchors:
        if a[1] <= field_calib_y:
            below = a
        elif above is None:
            above = a
            break

    if below is not None and above is not None:
        calib_dy = above[1] - below[1]
        actual_dy = above[0].center_y() - below[0].center_y()
        if calib_dy <= 0 or actual_dy < 5:
            closer = below if abs(field_calib_y - below[1]) <= abs(field_calib_y - above[1]) else above
            pred_y = closer[0].center_y()
            local_scale = fallback_scale
            origin_x = closer[0].left() - closer[2] * local_scale
            pred_x = origin_x + field_calib_x * local_scale
            return pred_y, pred_x, local_scale
        fraction = (field_calib_y - below[1]) / calib_dy
        pred_y = below[0].center_y() + fraction * actual_dy
        local_scale = actual_dy / calib_dy
        origin_x = below[0].left() - below[2] * local_scale
        pred_x = origin_x + field_calib_x * local_scale
        return pred_y, pred_x, local_scale

    if below is not None:
        if len(sorted_anchors) >= 2:
            a1 = sorted_anchors[-2]
            a2 = sorted_anchors[-1]
            calib_dy = a2[1] - a1[1]
            if calib_dy > 0:
                local_scale = (a2[0].center_y() - a1[0].center_y()) / calib_dy
                pred_y = a2[0].center_y() + (field_calib_y - a2[1]) * local_scale
                origin_x = a2[0].left() - a2[2] * local_scale
                return pred_y, origin_x + field_calib_x * local_scale, local_scale
        pred_y = below[0].center_y() + (field_calib_y - below[1]) * fallback_scale
        origin_x = below[0].left() - below[2] * fallback_scale
        return pred_y, origin_x + field_calib_x * fallback_scale, fallback_scale

    if above is not None:
        if len(sorted_anchors) >= 2:
            a1 = sorted_anchors[0]
            a2 = sorted_anchors[1]
            calib_dy = a2[1] - a1[1]
            if calib_dy > 0:
                local_scale = (a2[0].center_y() - a1[0].center_y()) / calib_dy
                pred_y = a1[0].center_y() - (a1[1] - field_calib_y) * local_scale
                origin_x = a1[0].left() - a1[2] * local_scale
                return pred_y, origin_x + field_calib_x * local_scale, local_scale
        pred_y = above[0].center_y() - (above[1] - field_calib_y) * fallback_scale
        origin_x = above[0].left() - above[2] * fallback_scale
        return pred_y, origin_x + field_calib_x * fallback_scale, fallback_scale

    return None


def _pick_value(
    candidates: list[OcrItem],
    pred_y: float,
    pred_x: float,
    validator,
    multi_line: bool,
) -> str | None:
    if not candidates:
        return None

    if multi_line:
        ordered = sorted(candidates, key=lambda it: (it.center_y(), it.left()))
        value = " ".join(it.text for it in ordered).strip()
        return value if validator(value) else None

    ordered = sorted(
        candidates,
        key=lambda it: (abs(it.center_y() - pred_y), abs(it.left() - pred_x)),
    )
    for cand in ordered:
        if validator(cand.text):
            return cand.text.strip()
    return None


def _split_rt_rw(value: str) -> tuple[str | None, str | None]:
    m = re.search(r"(\d{1,3})\s*/\s*(\d{1,3})", value)
    if not m:
        return value.strip(), None
    return m.group(1), m.group(2)


def _split_tempat_tgl(value: str) -> tuple[str | None, str | None]:
    m = DATE_RE.search(value)
    if m:
        date = m.group(0)
        place = value[:m.start()].rstrip(" ,.\t")
        place = re.sub(r"^[^a-zA-Z]+", "", place)
        return (place if place else None, date)
    digits = re.sub(r"\D", "", value)
    if len(digits) == 8:
        date = f"{digits[0:2]}-{digits[2:4]}-{digits[4:8]}"
        m_first_digit = re.search(r"\d", value)
        place = value[:m_first_digit.start()].rstrip(" ,.\t") if m_first_digit else ""
        place = re.sub(r"^[^a-zA-Z]+", "", place)
        return (place if place else None, date)
    return (value.strip() or None, None)


def _split_gol_sex(value: str) -> tuple[str | None, str | None]:
    stripped = value.strip()
    sex_match = re.search(
        r"\b(PRIA|WANITA|LAKI\-?LAKI|PEREMPUAN|MALE|FEMALE)\s*$",
        stripped.upper(),
    )
    if sex_match:
        sex = sex_match.group(1)
        blood_part = stripped[: sex_match.start()].strip()
        blood_clean = re.sub(r"[^A-Z0-9]", "", blood_part.upper())
        if blood_clean not in {"A", "B", "AB", "O", "0"}:
            return None, sex
        return blood_clean, sex
    parts = re.split(r"[\s\-]+", stripped, maxsplit=1)
    if len(parts) < 2:
        return None, stripped
    blood = parts[0].strip().upper()
    sex = parts[1].strip()
    if blood not in {"A", "B", "AB", "O", "0"}:
        return None, sex
    return blood, sex
