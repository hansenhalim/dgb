<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;

class ExtractIdController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $file = $request->file('image');

        $pending = Http::attach(
            'image',
            fopen($file->getRealPath(), 'r'),
            $file->getClientOriginalName(),
        );

        $payload = $request->filled('fields')
            ? ['fields' => $request->input('fields')]
            : [];

        $response = $pending->post(config('services.ocr.url').'/extract-id', $payload);

        return response($response->body(), $response->status())
            ->header('Content-Type', $response->header('Content-Type'));
    }
}
