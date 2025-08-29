<?php

namespace App\Http\Controllers;

use App\Enum\CurrentPosition;
use App\Http\Requests\StoreVisitRequest;
use App\Models\Rfid;
use App\Models\Visit;
use App\Models\Visitor;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class VisitController extends Controller
{
    public function index(Visitor $visitor)
    {
        $visits = $visitor->visits()->latest()->get([
            'id',
            'vehicle_plate_number',
            'purpose_of_visit',
            'destination_name',
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

        $payload = [
            "visit_id" => $visit->id,
            "identity_number" => Str::mask($identityNumber, '*', -13, 10),
            "fullname" => $this->maskName($fullname),
            "vehicle_plate_number" => $vehiclePlateNumber,
            "purpose_of_visit" => $purposeOfVisit,
            "destination_name" => $destinationName,
            "created_at" => $visit->created_at,
        ];

        return response()->json([
            "message" => "Visit created successfully",
            "data" => [
                "id" => $visit->id,
                "rfid_key" => $rfidKey,
                "payload" => $payload,
            ]
        ]);
    }

    public function checkin(Request $request, Visit $visit)
    {
        $visit->checkin_at = now();
        $visit->checkin_gate_id = $request->input('gate_id');
        $visit->current_position = CurrentPosition::VILLA1;
        $visit->save();

        return response()->json([
            'message' => 'Gate opened successfully',
        ]);
    }

    public function checkout(Request $request, Visit $visit)
    {
        $visit->checkout_at = now();
        $visit->checkout_gate_id = $request->input('gate_id');
        $visit->current_position = CurrentPosition::OUTSIDE;
        $visit->save();

        return response()->json([
            'message' => 'Gate opened successfully',
        ]);
    }

    public function transit(Request $request, Visit $visit)
    {
        $visit->current_position = CurrentPosition::TRANSIT;
        $visit->save();

        return response()->json([
            'message' => 'Gate opened successfully',
        ]);
    }

    public function transitEnter(Request $request, Visit $visit)
    {
        $visit->current_position = CurrentPosition::TRANSIT;
        $visit->save();

        return response()->json([
            'message' => 'Gate opened successfully',
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

}
