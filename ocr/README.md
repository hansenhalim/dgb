# OCR Service API

FastAPI service that runs RapidOCR and extracts structured fields from Indonesian ID cards (KTP, SIM).

Base URL: `http://localhost:5000` (or whichever port `uvicorn` is bound to).

## Endpoints

| Method | Path          | Description                                                                |
| ------ | ------------- | -------------------------------------------------------------------------- |
| `POST` | `/extract-id` | Run OCR + extraction on a KTP/SIM image. Returns structured ID fields.     |
| `GET`  | `/health`     | Liveness probe. Returns `{ "status": "ok" }`.                              |

---

## `POST /extract-id`

Detects the document type (KTP / SIM Modern / SIM 6-Line / SIM Old) from the image, then extracts the fields associated with that type.

### Request

- **Content-Type:** `multipart/form-data`

| Field    | Type     | Required | Description                                                                                                                                |
| -------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `image`  | file     | yes      | KTP or SIM image. Must be an image MIME type. Max size: **512 KB**.                                                                        |
| `fields` | string   | no       | Comma-separated whitelist of field names to return (e.g. `nik,nama`). Empty / omitted means "return all fields for the detected type".     |

When `fields` is provided, the response includes only the **intersection** of (requested fields) ∩ (the detected type's fields). Requested fields that don't exist on the detected type are silently dropped.

### Response (success)

`200 OK`

```json
{
  "message": "Success",
  "data": {
    "type": "ktp",
    "data": {
      "nik": "0000000000000000",
      "nama": "JOHN DOE",
      "tempat_lahir": "JAKARTA",
      "tanggal_lahir": "01-01-1990",
      "jenis_kelamin": "LAKI-LAKI",
      "golongan_darah": "O",
      "alamat": "JL. CONTOH NO. 1",
      "rt": "001",
      "rw": "002",
      "kelurahan": "KELURAHAN",
      "kecamatan": "KECAMATAN",
      "agama": "ISLAM",
      "status_perkawinan": "BELUM KAWIN",
      "pekerjaan": "KARYAWAN SWASTA",
      "kewarganegaraan": "WNI",
      "berlaku_hingga": "SEUMUR HIDUP",
      "provinsi": "PROVINSI",
      "kota": "KOTA"
    }
  }
}
```

`data.type` is one of `ktp`, `sim`, `sim_modern`, `sim_6_line`, `sim_old`.

`data.data` is an object whose keys depend on `data.type`. Missing values are `null` (except `golongan_darah`, which falls back to `"-"`).

#### KTP fields

`nik`, `nama`, `tempat_lahir`, `tanggal_lahir`, `jenis_kelamin`, `golongan_darah`, `alamat`, `rt`, `rw`, `kelurahan`, `kecamatan`, `agama`, `status_perkawinan`, `pekerjaan`, `kewarganegaraan`, `berlaku_hingga`, `provinsi`, `kota`

#### SIM fields (all SIM variants)

`nomor_sim`, `nama`, `tempat_lahir`, `tanggal_lahir`, `golongan_darah`, `jenis_kelamin`, `alamat`, `pekerjaan`, `tempat_pembuatan`, `jenis_sim`, `tanggal_berlaku`

### Response (no text detected)

`422 Unprocessable Entity`

```json
{
  "message": "No text detected in image",
  "data": null
}
```

### Response (validation error)

`422 Unprocessable Entity`. Uses FastAPI's default shape:

```json
{ "detail": "Image exceeds 512KB limit." }
```

```json
{ "detail": "Uploaded file must be an image." }
```

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "image"],
      "msg": "Field required"
    }
  ]
}
```

### Examples

Basic KTP extraction:

```bash
curl --request POST \
  --url http://localhost:5000/extract-id \
  --header 'Accept: application/json' \
  --form 'image=@/path/to/KTP.jpg'
```

SIM Old extraction:

```bash
curl --request POST \
  --url http://localhost:5000/extract-id \
  --form 'image=@/path/to/SIM.jpg'
```

```json
{
  "message": "Success",
  "data": {
    "type": "sim_old",
    "data": {
      "nomor_sim": "000000000000",
      "nama": "JANE DOE",
      "tempat_lahir": "BANDUNG",
      "tanggal_lahir": "01-01-1985",
      "golongan_darah": "-",
      "jenis_kelamin": "WANITA",
      "alamat": "JL. CONTOH NO. 2",
      "pekerjaan": "IBU RUMAH TANGGA",
      "tempat_pembuatan": "KAPOLRESTA",
      "jenis_sim": "A",
      "tanggal_berlaku": "01-01-2030"
    }
  }
}
```

Filter fields:

```bash
curl --request POST \
  --url http://localhost:5000/extract-id \
  --form 'image=@/path/to/KTP.jpg' \
  --form 'fields=nik,nama,tanggal_lahir'
```

```json
{
  "message": "Success",
  "data": {
    "type": "ktp",
    "data": {
      "nik": "0000000000000000",
      "nama": "JOHN DOE",
      "tanggal_lahir": "01-01-1990"
    }
  }
}
```

If a requested field is not part of the detected type (e.g. `nomor_sim` on a KTP), it's dropped from the response.

---

## Local development

```bash
cd ocr
uv pip install -r requirements.txt
.venv/bin/uvicorn server:app --host 0.0.0.0 --port 5000 --reload
```

Interactive OpenAPI docs: `http://localhost:5000/docs`.
