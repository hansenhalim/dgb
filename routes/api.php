<?php

use App\Http\Controllers\RFIDController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/auth/lookup-uid', [RFIDController::class, 'lookupUID']);
Route::post('/auth/verify-pin', [RFIDController::class, 'verifyPIN']);
Route::post('/auth/verify-secret', [RFIDController::class, 'verifySecret']);