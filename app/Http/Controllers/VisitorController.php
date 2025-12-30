<?php

namespace App\Http\Controllers;

use App\Models\Visitor;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class VisitorController extends Controller
{
    public function show(Request $request)
    {
        $identityNumber = $request->input('identity_number');

        $visitor = Visitor::select(['id', 'fullname', 'banned_at', 'banned_reason'])
            ->where(['identity_number' => Str::of($identityNumber)->hash('sha256')])
            ->first();

        if (! $visitor) {
            return response()->noContent();
        }

        return response()->json([
            'message' => 'Visitor status retrieved successfully',
            'data' => $visitor,
        ]);
    }
}
