<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreVisitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'uid' => ['required', 'string', 'size:8', 'regex:/^[A-F0-9]+$/'],
            'identity_photo' => ['required', 'file', 'image', 'max:512'],
            'identity_number' => ['string', 'size:16', 'numeric'],
            'fullname' => ['string', 'max:255'],
            'vehicle_plate_number' => ['string', 'max:20'],
            'purpose_of_visit' => ['required', 'string', 'max:255'],
            'destination_name' => ['required', 'string', 'max:30'],
        ];
    }

    public function messages(): array
    {
        return [
            'uid.regex' => 'UID must be a valid 8-character hexadecimal string.',
            'identity_photo.max' => 'Photo exceeds 512KB limit or invalid input',
            'identity_number.size' => 'NIK must be exactly 16 digits.',
            'identity_number.numeric' => 'NIK must contain only numbers.',
        ];
    }
}
