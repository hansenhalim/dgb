<?php

namespace App\Http\Controllers;

use App\Models\Gate;

class GateController extends Controller
{
    public function index()
    {
        $gates = Gate::select(['id', 'name', 'current_quota'])
            ->oldest('id')
            ->get()
            ->map(function ($gate) {
                $gate->is_available = config("app.gate_{$gate->id}_is_available", true);
                return $gate;
            });

        return response()->json([
            'message' => 'Successfully retrieved available gates.',
            'data' => $gates,
        ]);
    }
}
