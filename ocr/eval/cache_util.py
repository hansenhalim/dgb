from __future__ import annotations

import hashlib
import json
from pathlib import Path

from extractors.ocr_item import OcrItem
from extractors.pipeline import OCR_CONFIG_ID, run_ocr

CACHE_DIR = Path(__file__).parent / "cache"


def cached_ocr(image_bytes: bytes) -> list[OcrItem]:
    # Key on both the image and the OCR config so changing the engine or the
    # noise guard invalidates the cache instead of returning stale OCR output.
    key = hashlib.sha256(image_bytes + OCR_CONFIG_ID.encode()).hexdigest()
    cache_path = CACHE_DIR / f"{key}.json"

    if cache_path.exists():
        data = json.loads(cache_path.read_text())
        return [OcrItem(text=d["text"], rec_poly=d["rec_poly"]) for d in data]

    items = run_ocr(image_bytes)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(
        json.dumps(
            [{"text": i.text, "rec_poly": i.rec_poly} for i in items],
            ensure_ascii=False,
        )
    )
    return items
