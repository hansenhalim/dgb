<?php

namespace App\Http\Controllers;

use App\Enum\Status;
use App\Http\Requests\StoreTransferRequestRequest;
use App\Http\Requests\UpdateTransferRequestRequest;
use App\Models\Gate;
use App\Models\TransferRequest;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Response;

class TransferRequestController extends Controller
{
    public function index(Gate $gate)
    {
        $gateId = $gate->id;

        $transferRequest = TransferRequest::query()
            ->where('status', Status::PENDING)
            ->where(function (Builder $query) use ($gateId) {
                $query->where('from_gate_id', $gateId)
                    ->orWhere('to_gate_id', $gateId);
            })
            ->first();

        if (!$transferRequest) {
            return response()->noContent();
        }

        return response()->json([
            'message' => 'Transfer request found.',
            'data' => [
                'id' => $transferRequest->id,
                'amount' => $transferRequest->amount,
                'from_gate' => [
                    'id' => $transferRequest->fromGate->id,
                    'name' => $transferRequest->fromGate->name,
                ],
                'to_gate' => [
                    'id' => $transferRequest->toGate->id,
                    'name' => $transferRequest->toGate->name,
                ],
            ],
        ]);
    }

    public function store(StoreTransferRequestRequest $request)
    {
        $amount = $request->integer('amount');
        $fromGateId = $request->integer('from_gate');
        $toGateId = $request->integer('to_gate');

        $exists = TransferRequest::query()
            ->where('status', Status::PENDING)
            ->where(function (Builder $query) use ($fromGateId, $toGateId) {
                $query->where('from_gate_id', $fromGateId)
                    ->orWhere('to_gate_id', $toGateId);
            })
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'Invalid request data or transfer already pending.'
            ], Response::HTTP_BAD_REQUEST);
        }

        if (Gate::findOrFail($fromGateId)->current_quota < $amount) {
            return response()->json([
                'message' => "Amount must be smaller or equal to source gate card amount.",
            ], Response::HTTP_BAD_REQUEST);
        }

        $transferRequest = new TransferRequest();
        $transferRequest->status = Status::PENDING;
        $transferRequest->from_gate_id = $fromGateId;
        $transferRequest->to_gate_id = $toGateId;
        $transferRequest->sender_staff_id = $request->user()->id;
        $transferRequest->amount = $amount;

        $transferRequest->save();

        return response()->json([
            'message' => "Transfer request created successfully.",
        ]);
    }

    public function respond(UpdateTransferRequestRequest $request, TransferRequest $transferRequest)
    {
        $status = $request->input('status');

        if ($transferRequest->status !== Status::PENDING) {
            return response()->json([
                'message' => "Request already responded.",
            ], Response::HTTP_BAD_REQUEST);
        }

        $amount = $transferRequest->amount;

        if ($status === 'confirm') {
            $transferRequest->fromGate->current_quota -= $amount;
            $transferRequest->toGate->current_quota += $amount;

            $transferRequest->status = Status::CONFIRMED;
        } elseif ($status === 'reject') {
            // Do nothing here

            $transferRequest->status = Status::REJECTED;
        }

        $transferRequest->recipient_staff_id = $request->user()->id;
        $transferRequest->responded_at = now();

        $transferRequest->push();

        return response()->json([
            'message' => "Transfer request {$transferRequest->status->respond()} successfully.",
        ]);
    }
}
