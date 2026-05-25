from __future__ import annotations

from rapidocr import LangRec, OCRVersion, RapidOCR

from .clean_extracted_values import CleanExtractedValues
from .clean_ocr_text import CleanOcrText
from .determine_id_type import DetermineIdType
from .extract_fields import ExtractFields
from .label_dictionary import LABELS
from .ocr_item import OcrItem

engine = RapidOCR(
    params={
        "Global.use_cls": False,
        "Det.ocr_version": OCRVersion.PPOCRV5,
        "Rec.lang_type": LangRec.EN,
        "Rec.ocr_version": OCRVersion.PPOCRV5,
    }
)


def run_ocr(image_bytes: bytes) -> list[OcrItem]:
    result = engine(image_bytes)
    boxes = getattr(result, "boxes", None)
    txts = getattr(result, "txts", None)
    rec_texts = list(txts) if txts is not None else []
    polys = (
        boxes.tolist() if hasattr(boxes, "tolist") else (list(boxes) if boxes else [])
    )

    items: list[OcrItem] = []
    for i, raw in enumerate(rec_texts):
        text = raw.strip()
        if text == "":
            continue
        poly = polys[i] if i < len(polys) else []
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
