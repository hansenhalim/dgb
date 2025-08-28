<?php

namespace App\Http\Controllers;

use App\Enum\Role;
use App\Http\Requests\GetRfidKeyRequest;
use App\Http\Requests\LookupUidRequest;
use App\Http\Requests\VerifyPinRequest;
use App\Http\Requests\VerifySecretRequest;
use App\Models\Rfid;
use App\Models\Staff;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class RfidController extends Controller
{
    public function lookupUid(LookupUidRequest $request): JsonResponse
    {
        $uid = $request->input('uid');
        $rfid = Rfid::whereUid($uid)->first();

        if (
            !$rfid ||
            !$rfid->rfidable instanceof Staff ||
            $rfid->rfidable->role !== Role::GUARD
        ) {
            return response()->json([
                'message' => 'RFID not found or not assigned to guard.',
            ], Response::HTTP_NOT_FOUND);
        }

        $guard = $rfid->rfidable;

        return response()->json([
            'message' => 'RFID matched.',
            'guard_name' => $guard->name,
        ]);
    }

    public function verifyPin(VerifyPinRequest $request): JsonResponse
    {
        $uid = $request->input('uid');
        $rfid = Rfid::whereUid($uid)->first();

        if (
            !$rfid ||
            !$rfid->rfidable instanceof Staff ||
            $rfid->rfidable->role !== Role::GUARD
        ) {
            return response()->json([
                'message' => 'RFID not found or not assigned to guard.',
            ], Response::HTTP_NOT_FOUND);
        }

        if (!Hash::check($request->input('pin'), $rfid->pin)) {
            return response()->json([
                'message' => 'Invalid PIN.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        return response()->json([
            'message' => 'PIN is valid.',
            'rfid_key' => $rfid->key,
        ]);
    }

    public function verifySecret(VerifySecretRequest $request): JsonResponse
    {
        $uid = $request->input('uid');
        $rfid = Rfid::whereUid($uid)->first();

        if (
            !$rfid ||
            !$rfid->rfidable instanceof Staff ||
            $rfid->rfidable->role !== Role::GUARD
        ) {
            return response()->json([
                'message' => 'RFID not found or not assigned to guard.',
            ], Response::HTTP_NOT_FOUND);
        }

        $guard = $rfid->rfidable;

        $secretKeyHex = $request->input('secret_key');
        $secretKeyBin = hex2bin($secretKeyHex);
        $secretKey = Str::of($secretKeyBin)->hash('sha256');

        if (!$secretKey->exactly($guard->secret_key)) {
            return response()->json([
                'message' => 'Invalid key.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $deviceName = $request->input('device_name');

        $token = $guard->createToken($deviceName)->plainTextToken;

        // Calculate token expiration (12 hours from now)
        $validUntil = now()->addHours(12)->utc()->toISOString();

        return response()->json([
            'message' => 'You have logged in successfully.',
            'token' => $token,
            'valid_until' => $validUntil, // in UTC
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'You have been logged out successfully.',
        ]);
    }

    public function getRfidKey(GetRfidKeyRequest $request): JsonResponse
    {
        $uid = $request->query('uid');
        $rfid = Rfid::whereUid($uid)->first();

        if (!$rfid || $rfid->rfidable instanceof Staff) {
            return response()->json([
                'message' => 'RFID not found or assigned to staff.',
            ], Response::HTTP_NOT_FOUND);
        }

        return response()->json([
            'message' => 'Successfully retrieving key.',
            'rfid_key' => $rfid->key,
        ]);
    }
}
