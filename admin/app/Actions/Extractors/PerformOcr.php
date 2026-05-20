<?php

namespace App\Actions\Extractors;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

final class PerformOcr
{
    /**
     * @return OcrItem[]
     */
    public function execute(UploadedFile $file): array
    {
        $base64 = base64_encode(file_get_contents($file->getRealPath()));

        $response = Http::post(config('services.paddleocr.url'), [
            'fileType' => 1,
            'file' => $base64,
        ]);

        $result = $response->json('result.ocrResults.0.prunedResult', []);

        info(json_encode($result));

        return $this->parseItems($result);
    }

    /**
     * @return OcrItem[]
     */
    private function parseItems(array $ocrData): array
    {
        $items = [];
        $recTexts = $ocrData['rec_texts'] ?? [];
        $recPolys = $ocrData['rec_polys'] ?? [];

        for ($i = 0; $i < count($recTexts); $i++) {
            $text = trim($recTexts[$i]);
            if ($text === '') {
                continue;
            }

            $items[] = new OcrItem(
                text: $text,
                recPoly: $recPolys[$i] ?? [],
            );
        }

        return $items;
    }
}
