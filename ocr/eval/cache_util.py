from __future__ import annotations

import hashlib
import json
from pathlib import Path

from extractors.ocr_item import OcrItem
from extractors.pipeline import run_ocr

CACHE_DIR = Path(__file__).parent / "cache"


def cached_ocr(image_bytes: bytes) -> list[OcrItem]:
    cache_path = CACHE_DIR / f"{hashlib.sha256(image_bytes).hexdigest()}.json"

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
