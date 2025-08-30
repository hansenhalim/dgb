<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

class VersionController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'message' => 'Get server version successfully',
            'data' => [
                'version' => 1,
            ],
        ]);
    }
}
