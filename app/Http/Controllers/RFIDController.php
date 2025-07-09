<?php

namespace App\Http\Controllers;

use App\Enum\Role;
use App\Http\Requests\LookupUIDRequest;
use App\Http\Requests\VerifyPINRequest;
use App\Http\Requests\VerifySecretRequest;
use App\Models\RFID;
use App\Models\Staff;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class RFIDController extends Controller
{
    public function lookupUID(LookupUIDRequest $request): JsonResponse
    {
        $uid = $request->input('uid');
        $rfid = Rfid::whereUID($uid)->first();

        if (!$rfid || !$rfid->rfidable instanceof Staff || $rfid->rfidable->role !== Role::Guard) {
            return response()->json([
                'message' => 'RFID not found or not assigned to guard.'
            ], Response::HTTP_NOT_FOUND);
        }

        $guard = $rfid->rfidable;

        return response()->json([
            'message' => 'RFID matched.',
            'guard_name' => $guard->name,
        ]);
    }

    public function verifyPIN(VerifyPINRequest $request): JsonResponse
    {
        return response()->json([
            'message' => 'PIN is valid.',
            'rfid_key' => 'CD4578F3A4BC...',
        ]);
    }

    public function verifySecret(VerifySecretRequest $request): JsonResponse
    {
        return response()->json([
            'message' => 'You have logged in successfully.',
            'rfid_key' => 'eyJhbGciOiJIUzI1NiIsInR5J9...',
        ]);
    }
}
