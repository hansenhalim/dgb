<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRFIDRequest;
use App\Http\Requests\UpdateRFIDRequest;
use App\Models\RFID;
use Illuminate\Http\JsonResponse;

class RFIDController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        //
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreRFIDRequest $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(RFID $rFID)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(RFID $rFID)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateRFIDRequest $request, RFID $rFID)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(RFID $rFID)
    {
        //
    }

    public function lookupUID(): JsonResponse
    {
        return response()->json('yes');
    }
}
