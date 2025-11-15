<?php

use App\Http\Controllers\DestinationController;
use App\Http\Controllers\GateController;
use App\Http\Controllers\NikOcrController;
use App\Http\Controllers\RfidController;
use App\Http\Controllers\TransferRequestController;
use App\Http\Controllers\VersionController;
use App\Http\Controllers\VisitController;
use App\Http\Controllers\VisitorController;
use Illuminate\Support\Facades\Route;

Route::get('/version', [VersionController::class, 'index']);
Route::post('/auth/lookup-uid', [RfidController::class, 'lookupUid']);
Route::post('/auth/verify-pin', [RfidController::class, 'verifyPin']);
Route::post('/auth/verify-secret', [RfidController::class, 'verifySecret']);

Route::middleware(['auth:sanctum'])->group(function () {
    Route::post('/auth/logout', [RfidController::class, 'logout']);
    Route::get('/rfid-key', [RfidController::class, 'getRfidKey']);
    Route::get('/gates', [GateController::class, 'index']);
    Route::get('/gates/{gate}/transfer-requests', [TransferRequestController::class, 'index']);
    Route::post('/transfer-requests', [TransferRequestController::class, 'store']);
    Route::patch('/transfer-requests/{transferRequest}', [TransferRequestController::class, 'respond']);
    Route::get('/visitors', [VisitorController::class, 'show']);
    Route::get('/visitors/{visitor}/visits', [VisitController::class, 'index']);
    Route::get('/destinations', [DestinationController::class, 'index']);
    Route::get('/visits/history', [VisitController::class, 'history']);
    Route::post('/visits', [VisitController::class, 'store']);
    Route::post('/visits/{visit}/checkin', [VisitController::class, 'checkin']);
    Route::post('/visits/{visit}/checkout', [VisitController::class, 'checkout']);
    Route::post('/visits/{visit}/transit', [VisitController::class, 'transit']);
    Route::post('/visits/{visit}/transit-enter', [VisitController::class, 'transitEnter']);
    Route::post('/gates/{gate}/decrement-quota', [VisitController::class, 'decrementQuota']);
    Route::post('/gates/{gate}/increment-quota', [VisitController::class, 'incrementQuota']);
    Route::post('/img-to-nik', [NikOcrController::class, 'extractNik']);
});
