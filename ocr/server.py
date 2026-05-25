from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from extractors.pipeline import run_extraction, run_ocr

app = FastAPI()

MAX_IMAGE_BYTES = 512 * 1024


def _parse_fields(fields: str | None) -> list[str]:
    if fields is None:
        return []
    return [f.strip() for f in fields.split(",") if f.strip()]


@app.post("/extract-id")
async def extract_id(
    image: UploadFile = File(...),
    fields: str | None = Form(None),
):
    if image.content_type is None or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="Uploaded file must be an image.")

    image_bytes = await image.read()

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=422, detail="Image exceeds 512KB limit.")

    items = run_ocr(image_bytes)

    if not items:
        return JSONResponse(
            status_code=422,
            content={"message": "No text detected in image", "data": None},
        )

    extracted = run_extraction(items)

    requested_fields = _parse_fields(fields)
    if requested_fields:
        extracted["data"] = {
            k: extracted["data"][k] for k in extracted["data"] if k in requested_fields
        }

    return {
        "message": "Success",
        "data": extracted,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
