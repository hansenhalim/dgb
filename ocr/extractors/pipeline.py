from __future__ import annotations

import json

from rapidocr import EngineType, LangRec, OCRVersion, RapidOCR

from .clean_extracted_values import CleanExtractedValues
from .clean_ocr_text import CleanOcrText
from .determine_id_type import DetermineIdType
from .extract_fields import ExtractFields
from .label_dictionary import LABELS
from .ocr_item import OcrItem

ENGINE_PARAMS = {
    "Global.use_cls": False,
    # Pin every module to OpenVINO. RapidOCR constructs the cls session at
    # init even with use_cls False, so leaving cls on the onnxruntime
    # default would require shipping onnxruntime just to start up.
    "Cls.engine_type": EngineType.OPENVINO,
    "Det.engine_type": EngineType.OPENVINO,
    "Det.ocr_version": OCRVersion.PPOCRV5,
    "Rec.engine_type": EngineType.OPENVINO,
    "Rec.lang_type": LangRec.EN,
    "Rec.ocr_version": OCRVersion.PPOCRV5,
    "EngineConfig.openvino.inference_num_threads": 4,
    "EngineConfig.openvino.performance_hint": "LATENCY",
}

engine = RapidOCR(params=ENGINE_PARAMS)


# A blank or non-document image can make the detector surface a single stray
# character where the ONNX Runtime engine returned nothing. Real KTP/SIM images
# always yield many detections, so we only treat lone, low-confidence
# single-character results as noise. The score gate keeps this from touching
# legitimate single-char fields (golongan_darah O/A/B, jenis_sim A/B/C), which
# score well above this threshold.
SPARSE_DETECTION_LIMIT = 2
MIN_SINGLE_CHAR_SCORE = 0.6


# Stable signature of everything that affects run_ocr output. The eval cache
# keys on this, so swapping the engine or retuning the noise guard invalidates
# stale OCR results instead of silently reusing them.
OCR_CONFIG_ID = json.dumps(
    {
        "params": {k: str(v) for k, v in ENGINE_PARAMS.items()},
        "sparse_detection_limit": SPARSE_DETECTION_LIMIT,
        "min_single_char_score": MIN_SINGLE_CHAR_SCORE,
    },
    sort_keys=True,
)


def run_ocr(image_bytes: bytes) -> list[OcrItem]:
    result = engine(image_bytes)
    boxes = getattr(result, "boxes", None)
    txts = getattr(result, "txts", None)
    scores = getattr(result, "scores", None)
    rec_texts = list(txts) if txts is not None else []
    rec_scores = list(scores) if scores is not None else []
    polys = (
        boxes.tolist() if hasattr(boxes, "tolist") else (list(boxes) if boxes else [])
    )

    candidates: list[tuple[str, float, list]] = []
    for i, raw in enumerate(rec_texts):
        text = raw.strip()
        if text == "":
            continue
        score = rec_scores[i] if i < len(rec_scores) else 1.0
        poly = polys[i] if i < len(polys) else []
        candidates.append((text, score, poly))

    sparse = len(candidates) <= SPARSE_DETECTION_LIMIT

    items: list[OcrItem] = []
    for text, score, poly in candidates:
        if sparse and len(text) == 1 and score < MIN_SINGLE_CHAR_SCORE:
            continue
        items.append(OcrItem(text=text, rec_poly=poly))

    return items


def run_extraction(items: list[OcrItem]) -> dict:
    cleaned_items = CleanOcrText().execute(items, LABELS)
    id_type = DetermineIdType().execute(cleaned_items, LABELS)
    extracted = ExtractFields().execute(cleaned_items, id_type, LABELS)
    extracted = CleanExtractedValues().execute(extracted)

    schema = {key: None for key in id_type.fields()}
    merged = {**schema, **{k: extracted[k] for k in extracted if k in schema}}

    return {
        "type": id_type.value.lower(),
        "data": merged,
    }
