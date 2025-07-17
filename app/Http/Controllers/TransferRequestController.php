<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTransferRequestRequest;
use App\Http\Requests\UpdateTransferRequestRequest;
use App\Models\Gate;
use App\Models\TransferRequest;

class TransferRequestController extends Controller
{
    public function index(Gate $gate)
    {
        $transferRequest = $gate->transferRequest;

        if (!$transferRequest) {
            return response()->noContent();
        }

        return response()->json([
            'message' => 'Transfer request found.',
            'data' => $transferRequest,
        ]);
    }

    public function store(StoreTransferRequestRequest $request)
    {
        //
    }

    public function respond(UpdateTransferRequestRequest $request, TransferRequest $transferRequest)
    {
        //
    }
}
