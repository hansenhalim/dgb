<?php

namespace App\Http\Controllers;

use App\Actions\Extractors\CleanExtractedValues;
use App\Actions\Extractors\CleanOcrText;
use App\Actions\Extractors\DetermineIdType;
use App\Actions\Extractors\ExtractFields;
use App\Actions\Extractors\LabelDictionary;
use App\Actions\Extractors\PerformOcr;
use App\Http\Requests\ExtractIdRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class ExtractIdController extends Controller
{
    public function __invoke(ExtractIdRequest $request): JsonResponse
    {
        $items = (new PerformOcr)->execute($request->file('image'));

        if (empty($items)) {
            return response()->json([
                'message' => 'No text detected in image',
                'data' => null,
            ], 422);
        }

        $labels = LabelDictionary::LABELS;

        $items = (new CleanOcrText)->execute($items, $labels);
        $idType = (new DetermineIdType)->execute($items, $labels);
        $fields = (new ExtractFields)->execute($items, $idType, $labels);
        $fields = (new CleanExtractedValues)->execute($fields);

        $schema = array_fill_keys($idType->fields(), null);
        $fields = array_merge($schema, array_intersect_key($fields, $schema));

        $requestedFields = $request->validated('fields');
        if (! empty($requestedFields)) {
            $fields = array_intersect_key($fields, array_flip($requestedFields));
        }

        $result = [
            'type' => strtolower($idType->value),
            'data' => $fields,
        ];

        $filename = pathinfo($request->file('image')->getClientOriginalName(), PATHINFO_FILENAME);
        Storage::disk('local')->put(
            "extractions/{$filename}.json",
            json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        return response()->json([
            'message' => 'Success',
            'data' => $result,
        ]);
    }
}
