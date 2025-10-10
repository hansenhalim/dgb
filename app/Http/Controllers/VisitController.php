<?php

namespace App\Http\Controllers;

use App\Enum\CurrentPosition;
use App\Enum\Position;
use App\Http\Requests\StoreVisitRequest;
use App\Models\Gate;
use App\Models\Rfid;
use App\Models\Staff;
use App\Models\Visit;
use App\Models\Visitor;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class VisitController extends Controller
{
    public function index(Visitor $visitor)
    {
        $visits = $visitor->visits()->latest()->limit(5)->get([
            'id',
            'vehicle_plate_number',
            'purpose_of_visit',
            'destination_name',
            'created_at',
        ]);

        return response()->json([
            'message' => 'Previous visit records retrieved successfully.',
            'data' => $visits,
        ]);
    }

    public function store(StoreVisitRequest $request)
    {
        $uid = $request->input('uid');
        $identityPhoto = $request->file('identity_photo');
        $identityNumber = $request->input('identity_number');
        $fullname = $request->input('fullname');
        $vehiclePlateNumber = $request->input('vehicle_plate_number');
        $purposeOfVisit = $request->input('purpose_of_visit');
        $destinationName = $request->input('destination_name');

        $rfid = Rfid::whereUid($uid)->first();

        if (!$rfid || $rfid->rfidable instanceof Staff) {
            return response()->json([
                'message' => 'RFID not found or assigned to staff.',
            ], Response::HTTP_NOT_FOUND);
        }

        $rfidKey = Str::upper($rfid->key);

        $visitor = Visitor::firstOrCreate([
            'identity_number' => Str::of($identityNumber)->hash('sha256'),
        ]);

        $visit = $visitor->visits()->create([
            'identity_photo' => DB::raw("decode('{$this->encryptToHex($identityPhoto)}', 'hex')"),
            'vehicle_plate_number' => $vehiclePlateNumber,
            'purpose_of_visit' => $purposeOfVisit,
            'destination_name' => $destinationName,
            'current_position' => CurrentPosition::OUTSIDE,
        ]);

        $rfid->rfidable()->associate($visit);
        $rfid->save();

        $payload = [
            'identity_number' => Str::mask($identityNumber, '*', -13, 10),
            'fullname' => $this->maskName($fullname),
            'vehicle_plate_number' => $vehiclePlateNumber,
            'purpose_of_visit' => $purposeOfVisit,
            'destination_name' => $destinationName,
            'allowed_gate_for_enter' => $this->getAllowedGateForEnter($visit),
            'allowed_gate_for_exit' => $this->getAllowedGateForExit($visit),
            'visit_id' => $visit->id,
            'transit_at' => null,
            'visited_gate_4' => false,
            'notes' => '',
        ];

        return response()->json([
            'message' => 'Visit created successfully',
            'data' => [
                'id' => $visit->id,
                'rfid_key' => $rfidKey,
                'payload' => $payload,
            ],
        ]);
    }

    public function checkin(Request $request, Visit $visit)
    {
        $gateId = $request->input('gate_id');

        if (!$request->boolean('skip_webhook')) {
            $this->callWebhook($gateId, 'in', $visit);
        }

        if ($visit->checkin_at) {
            return response()->json([
                'message' => 'Gate opened successfully',
            ]);
        }

        $visit->checkin_at = now();
        $visit->checkin_gate_id = $gateId;
        $visit->current_position = CurrentPosition::getCheckinPosition($gateId);
        $visit->save();

        $visit->visitor->update([
            'banned_at' => now(),
            'banned_reason' => "Checked in at gate $gateId",
        ]);

        Gate::where('id', $gateId)->decrement('current_quota');

        return response()->json([
            'message' => 'Gate opened successfully',
        ]);
    }

    public function checkout(Request $request, Visit $visit)
    {
        $gateId = $request->input('gate_id');

        if (!$request->boolean('skip_webhook')) {
            $this->callWebhook($gateId, 'out', $visit);
        }

        if ($visit->checkout_at) {
            return response()->json([
                'message' => 'Gate opened successfully',
            ]);
        }

        $visit->checkout_at = now();
        $visit->checkout_gate_id = $gateId;
        $visit->current_position = CurrentPosition::getCheckoutPosition($gateId);
        $visit->save();

        $visit->visitor->update([
            'banned_at' => null,
            'banned_reason' => null,
        ]);

        $visit->rfid?->rfidable()->dissociate();
        $visit->rfid?->save();

        Gate::where('id', $gateId)->increment('current_quota');

        return response()->json([
            'message' => 'Gate opened successfully',
        ]);
    }

    public function transit(Request $request, Visit $visit)
    {
        $gateId = $request->input('gate_id');

        if (!$request->boolean('skip_webhook')) {
            $this->callWebhook($gateId, 'out', $visit);
        }

        $visit->current_position = CurrentPosition::getTransitPosition($gateId);
        $visit->save();

        return response()->json([
            'message' => 'Gate opened successfully',
        ]);
    }

    public function transitEnter(Request $request, Visit $visit)
    {
        $gateId = $request->input('gate_id');

        if (!$request->boolean('skip_webhook')) {
            $this->callWebhook($gateId, 'in', $visit);
        }

        $visit->current_position = CurrentPosition::getTransitEnterPosition($gateId);
        $visit->save();

        return response()->json([
            'message' => 'Gate opened successfully',
        ]);
    }

    public function history(Request $request)
    {
        $gateId = $request->input('gate_id');

        if (!$gateId) {
            return response()->json([
                'message' => 'Gate ID is required',
            ], Response::HTTP_BAD_REQUEST);
        }

        $query = Visit::latest()->where(function ($q) use ($gateId) {
            $q->where('checkin_gate_id', $gateId)
                ->orWhere('checkout_gate_id', $gateId);
        });

        $visits = $query->limit(5)->get()->map(fn($visit) => [
            'id' => $visit->id,
            'vehicle_plate_number' => $visit->vehicle_plate_number,
            'current_position' => $visit->current_position->formatName(),
            'destination_name' => $visit->destination_name,
            'created_at' => $visit->created_at,
        ]);

        return response()->json([
            'message' => 'Successfully get visit history',
            'data' => $visits,
        ]);
    }

    private function encryptToHex(UploadedFile $file): string
    {
        $raw = file_get_contents($file->getRealPath());
        $encrypted = Crypt::encrypt($raw);
        $hex = bin2hex($encrypted);

        return $hex;
    }

    private function maskName(string $fullname): string
    {
        $words = explode(' ', trim($fullname));

        $maskedWords = array_map(function ($word) {
            $length = Str::length($word);

            if ($length <= 2) {
                // Mask all but first letter
                return Str::substr($word, 0, 1) . str_repeat('*', $length - 1);
            }

            if ($length <= 4) {
                // Keep first and last letters
                return Str::substr($word, 0, 1) .
                    str_repeat('*', $length - 2) .
                    Str::substr($word, -1);
            }

            // Keep first 2 and last 1 characters
            return Str::substr($word, 0, 2) .
                str_repeat('*', $length - 3) .
                Str::substr($word, -1);
        }, $words);

        return implode(' ', $maskedWords);
    }

    private function callWebhook(int $gateId, string $direction, Visit $visit): void
    {
        $webhookUrl = config("app.gate_{$gateId}_{$direction}_webhook_url");

        if (!$webhookUrl) {
            return;
        }

        try {
            Http::timeout(1)->get($webhookUrl);
        } catch (\Exception $e) {
            logger()->warning('Tasmota webhook request failed with exception', [
                'url' => $webhookUrl,
                'error' => $e->getMessage(),
                'gate_id' => $gateId,
                'direction' => $direction,
                'visit_id' => $visit->id,
            ]);
        }
    }

    private function getAllowedGateForEnter(Visit $visit): array
    {
        if (!$visit->destination) {
            return [];
        }

        return match ($visit->destination->position) {
            Position::VILLA1 => [1, 2],
            Position::VILLA2 => [3],
            Position::EXCLUSIVE => [3, 4],
        };
    }

    private function getAllowedGateForExit(Visit $visit): array
    {
        if (!$visit->destination) {
            return [];
        }

        return match ($visit->destination->position) {
            Position::VILLA1 => [3],
            Position::VILLA2 => [2],
            Position::EXCLUSIVE => [2, 4],
        };
    }
}
