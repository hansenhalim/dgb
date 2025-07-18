<?php

use App\Http\Controllers\GateController;
use App\Http\Controllers\RFIDController;
use App\Http\Controllers\TransferRequestController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/auth/lookup-uid', [RFIDController::class, 'lookupUID']);
Route::post('/auth/verify-pin', [RFIDController::class, 'verifyPIN']);
Route::post('/auth/verify-secret', [RFIDController::class, 'verifySecret']);

Route::middleware(['auth:sanctum'])->group(function () {
    Route::post('/auth/logout', [RFIDController::class, 'logout']);
    Route::get('/rfid-key', [RFIDController::class, 'getKey']);
    Route::get('/gates', [GateController::class, 'index']);
    Route::get('/gates/{gate}/transfer-requests', [TransferRequestController::class, 'index']);
    Route::post('/transfer-requests', [TransferRequestController::class, 'store']);
    Route::patch('/transfer-requests/{transferRequest}', [TransferRequestController::class, 'respond']);
});