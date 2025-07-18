<?php

namespace App\Http\Controllers;

use App\Models\Gate;

class GateController extends Controller
{
    public function index()
    {
        $gates = Gate::select(['id', 'name', 'current_quota', 'proximity_id'])
            ->oldest('id')
            ->get();

        return response()->json([
            'message' => 'Successfully retrieved available gates.',
            'data' => $gates,
        ]);
    }
}
