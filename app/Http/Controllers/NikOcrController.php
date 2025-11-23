<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Imagick;
use thiagoalessio\TesseractOCR\TesseractOCR;

class NikOcrController extends Controller
{
    public function extractNik(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'image', 'max:512'],
        ], [
            'image.required' => 'An image file is required.',
            'image.image' => 'The file must be a valid image.',
            'image.max' => 'The image size must not exceed 512KB.',
        ]);

        $processedImagePath = null;
        $rawImagePath = null;

        try {
            $image = $request->file('image');
            $imagePath = $image->getRealPath();

            $timestamp = now()->format('Y-m-d_H-i-s');

            $rawImagePath = storage_path("app/private/Img2NIK_{$timestamp}_0000000000000000.{$image->getClientOriginalExtension()}");
            copy($imagePath, $rawImagePath);

            $im = new Imagick($imagePath);

            $im->gaussianBlurImage(0, 1.0);

            $threshold = $this->calculateOtsuThreshold($im);

            $im->thresholdImage($threshold * Imagick::getQuantum());
            $im->stripImage();

            $im->setImageFormat('jpg');
            $im->setImageCompressionQuality(95);

            $processedImagePath = storage_path("app/private/Img2NIK_{$timestamp}_temp.jpg");
            $im->writeImage($processedImagePath);

            $tessdataPath = resource_path('tessdata');

            $nik = (new TesseractOCR($processedImagePath))
                ->tessdataDir($tessdataPath)
                ->lang('nik')
                ->run();

            // Remove all non-digit characters (spaces, dashes, etc.)
            $cleanedNik = preg_replace('/\D/', '', $nik);

            $validationResult = $this->validateNik($cleanedNik);

            // Rename processed file with OCR result for debugging
            $ocrResultForFilename = ! empty($cleanedNik) ? $cleanedNik : 'no_result';
            $validStatus = $validationResult['valid'] ? 'valid' : 'invalid';
            $newProcessedImagePath = storage_path("app/private/Img2NIK_{$timestamp}_{$ocrResultForFilename}_{$validStatus}.jpg");
            rename($processedImagePath, $newProcessedImagePath);
            $processedImagePath = $newProcessedImagePath;

            if (! $validationResult['valid']) {
                return response()->json([
                    'message' => 'Failed to extract valid NIK',
                    'data' => [
                        'nik' => null,
                        'extracted_text' => $cleanedNik,
                        'validation_errors' => $validationResult['errors'],
                    ],
                ], 422);
            }

            return response()->json([
                'message' => 'NIK extracted successfully',
                'data' => [
                    'nik' => $cleanedNik,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to process image',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function calculateOtsuThreshold(Imagick $image): float
    {
        $image->transformImageColorspace(Imagick::COLORSPACE_GRAY);

        $width = $image->getImageWidth();
        $height = $image->getImageHeight();
        $totalPixels = $width * $height;

        $pixelIterator = $image->getPixelIterator();

        $histogram = array_fill(0, 256, 0);

        foreach ($pixelIterator as $pixels) {
            foreach ($pixels as $pixel) {
                $color = $pixel->getColor();
                $gray = (int) $color['r'];
                $gray = max(0, min(255, $gray));

                $histogram[$gray]++;
            }
        }

        $sum = 0;
        for ($i = 0; $i < 256; $i++) {
            $sum += $i * $histogram[$i];
        }

        $sumB = 0;
        $wB = 0;
        $wF = 0;
        $maxVariance = 0;
        $threshold = 0;

        for ($t = 0; $t < 256; $t++) {
            $wB += $histogram[$t];
            if ($wB == 0) {
                continue;
            }

            $wF = $totalPixels - $wB;
            if ($wF == 0) {
                break;
            }

            $sumB += $t * $histogram[$t];

            $mB = $sumB / $wB;
            $mF = ($sum - $sumB) / $wF;

            $variance = $wB * $wF * ($mB - $mF) * ($mB - $mF);

            if ($variance > $maxVariance) {
                $maxVariance = $variance;
                $threshold = $t;
            }
        }

        return $threshold / 255;
    }

    private function validateNik(string $nik): array
    {
        $errors = [];
        $info = [];

        if (strlen($nik) !== 16) {
            $errors[] = 'NIK must be exactly 16 digits';

            return ['valid' => false, 'errors' => $errors, 'info' => $info];
        }

        $kodeWilayah = substr($nik, 0, 6);
        $tanggal = substr($nik, 6, 2);
        $bulan = substr($nik, 8, 2);
        $tahun = substr($nik, 10, 2);
        $serial = substr($nik, 12, 4);

        $kodeWilayahData = json_decode(file_get_contents(storage_path('app/private/kodewilayah.json')), true);

        if (! isset($kodeWilayahData[$kodeWilayah])) {
            $errors[] = "Invalid region code: {$kodeWilayah}";
        } else {
            $info['region'] = $kodeWilayahData[$kodeWilayah];
        }

        $day = (int) $tanggal;
        $isFemale = false;

        if ($day > 40) {
            $day -= 40;
            $isFemale = true;
        }

        $month = (int) $bulan;
        $year = (int) $tahun;

        $currentYear = (int) date('y');
        $fullYear = ($year <= $currentYear) ? 2000 + $year : 1900 + $year;

        if ($day < 1 || $day > 31) {
            $errors[] = "Invalid day: {$day}";
        }

        if ($month < 1 || $month > 12) {
            $errors[] = "Invalid month: {$month}";
        }

        if ($day >= 1 && $day <= 31 && $month >= 1 && $month <= 12) {
            if (! checkdate($month, $day, $fullYear)) {
                $errors[] = "Invalid date: {$day}-{$month}-{$fullYear}";
            } else {
                $info['birth_date'] = sprintf('%04d-%02d-%02d', $fullYear, $month, $day);
                $info['gender'] = $isFemale ? 'Female' : 'Male';
            }
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
            'info' => $info,
        ];
    }
}
