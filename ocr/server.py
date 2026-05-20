import base64

from fastapi import FastAPI
from pydantic import BaseModel
from rapidocr import LangRec, OCRVersion, RapidOCR

app = FastAPI()

engine = RapidOCR(
    params={
        "Global.use_cls": False,
        "Det.ocr_version": OCRVersion.PPOCRV5,
        "Rec.lang_type": LangRec.EN,
        "Rec.ocr_version": OCRVersion.PPOCRV5,
    }
)


class OcrRequest(BaseModel):
    file: str
    fileType: int = 1


@app.post("/ocr")
async def ocr(request: OcrRequest):
    image_bytes = base64.b64decode(request.file)
    result = engine(image_bytes)
    boxes = getattr(result, "boxes", None)
    txts = getattr(result, "txts", None)
    rec_texts = list(txts) if txts is not None else []
    polys = (
        boxes.tolist() if hasattr(boxes, "tolist") else (list(boxes) if boxes else [])
    )

    return {
        "result": {
            "ocrResults": [
                {
                    "prunedResult": {
                        "rec_texts": rec_texts,
                        "rec_polys": polys,
                    },
                }
            ]
        }
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
