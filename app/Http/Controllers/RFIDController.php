<?php

namespace App\Http\Controllers;

use App\Enum\Role;
use App\Http\Requests\GetKeyRequest;
use App\Http\Requests\LookupUIDRequest;
use App\Http\Requests\VerifyPINRequest;
use App\Http\Requests\VerifySecretRequest;
use App\Models\RFID;
use App\Models\Staff;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class RFIDController extends Controller
{
    public function lookupUID(LookupUIDRequest $request): JsonResponse
    {
        $uid = $request->input('uid');
        $rfid = Rfid::whereUID($uid)->first();

        if (
            !$rfid ||
            !$rfid->rfidable instanceof Staff ||
            $rfid->rfidable->role !== Role::Guard
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

    public function verifyPIN(VerifyPINRequest $request): JsonResponse
    {
        $uid = $request->input('uid');
        $rfid = Rfid::whereUID($uid)->first();

        if (
            !$rfid ||
            !$rfid->rfidable instanceof Staff ||
            $rfid->rfidable->role !== Role::Guard
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

        $key = stream_get_contents($rfid->key, 96);
        $rfidKey = Str::upper(bin2hex($key));

        return response()->json([
            'message' => 'PIN is valid.',
            'rfid_key' => $rfidKey,
        ]);
    }

    public function verifySecret(VerifySecretRequest $request): JsonResponse
    {
        $uid = $request->input('uid');
        $rfid = Rfid::whereUID($uid)->first();

        if (
            !$rfid ||
            !$rfid->rfidable instanceof Staff ||
            $rfid->rfidable->role !== Role::Guard
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

        return response()->json([
            'message' => 'You have logged in successfully.',
            'token' => $token
        ]);
    }

    public function getKey(GetKeyRequest $request): JsonResponse
    {
        $uid = $request->query('uid');
        $rfid = Rfid::whereUID($uid)->first();

        if (!$rfid || $rfid->rfidable instanceof Staff) {
            return response()->json([
                'message' => 'RFID not found or assigned to guard.',
            ], Response::HTTP_NOT_FOUND);
        }

        $key = stream_get_contents($rfid->key, 96);
        $rfidKey = Str::upper(bin2hex($key));

        return response()->json([
            'message' => 'Successfully retrieving key.',
            'rfid_key' => $rfidKey,
        ]);
    }
}
