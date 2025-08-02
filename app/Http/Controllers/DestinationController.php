<?php

namespace App\Http\Controllers;

use App\Models\Destination;

class DestinationController extends Controller
{
    public function index()
    {
        $destinations = Destination::get(['name', 'position'])
            ->map(fn($destination) => [
                'name' => $destination->name,
                'position' => $destination->position->human(),
            ]);

        return response()->json([
            'message' => 'Destinations retrieved successfully.',
            'data' => $destinations,
        ]);
    }
}
