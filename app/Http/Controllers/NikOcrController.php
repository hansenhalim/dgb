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

        try {
            $image = $request->file('image');
            $imagePath = $image->getRealPath();

            $im = new Imagick($imagePath);

            // Scale image to 300 DPI for better OCR accuracy
            $this->scaleImageToDpi($im, 300);

            // Calculate Otsu's threshold
            $threshold = $this->calculateOtsuThreshold($im);

            // Apply threshold
            $im->thresholdImage($threshold * Imagick::getQuantum());
            $im->stripImage();

            // Set image format to JPG with high quality
            $im->setImageFormat('jpg');
            $im->setImageCompressionQuality(95);

            $processedImagePath = storage_path('app/private/processed_'.uniqid('nik_', true).'.jpg');
            $im->writeImage($processedImagePath);

            $tessdataPath = resource_path('tessdata');

            $nik = (new TesseractOCR($processedImagePath))
                ->tessdataDir($tessdataPath)
                ->lang('nik')
                ->run();

            $trimmedNik = trim($nik);

            return response()->json([
                'message' => $trimmedNik ? 'NIK extracted successfully' : 'No text found in image',
                'data' => [
                    'nik' => $trimmedNik,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to process image',
                'error' => $e->getMessage(),
            ], 500);
        } finally {
            if ($processedImagePath && file_exists($processedImagePath)) {
                // unlink($processedImagePath);
            }
        }
    }

    private function calculateOtsuThreshold(Imagick $image): float
    {
        // Convert to grayscale
        $image->transformImageColorspace(Imagick::COLORSPACE_GRAY);

        // Get image dimensions
        $width = $image->getImageWidth();
        $height = $image->getImageHeight();
        $totalPixels = $width * $height;

        // Get pixel iterator
        $pixelIterator = $image->getPixelIterator();

        // Build histogram
        $histogram = array_fill(0, 256, 0);

        foreach ($pixelIterator as $pixels) {
            foreach ($pixels as $pixel) {
                $color = $pixel->getColor();
                $gray = (int) $color['r']; // Since it's grayscale, r=g=b

                // Ensure gray value is within valid range (0-255)
                $gray = max(0, min(255, $gray));

                $histogram[$gray]++;
            }
        }

        // Calculate Otsu's threshold
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

        // Return normalized threshold (0-1 range)
        return $threshold / 255;
    }

    private function scaleImageToDpi(Imagick $image, int $targetDpi): void
    {
        // Get current image resolution
        $resolution = $image->getImageResolution();
        $currentDpi = $resolution['x']; // Assuming x and y are the same

        // Handle images without DPI information (set default to 72 DPI)
        if ($currentDpi <= 0) {
            $currentDpi = 72;
        }

        // Calculate scaling factor
        $scaleFactor = $targetDpi / $currentDpi;

        // Only scale if needed (avoid unnecessary processing)
        if (abs($scaleFactor - 1.0) > 0.01) {
            $width = $image->getImageWidth();
            $height = $image->getImageHeight();

            $newWidth = (int) round($width * $scaleFactor);
            $newHeight = (int) round($height * $scaleFactor);

            // Resize image using Lanczos filter for best quality
            $image->resizeImage($newWidth, $newHeight, Imagick::FILTER_LANCZOS, 1);
        }

        // Set the image resolution to target DPI
        $image->setImageResolution($targetDpi, $targetDpi);
        $image->setImageUnits(Imagick::RESOLUTION_PIXELSPERINCH);
    }
}
