<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreTransferRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'integer', 'between:1,65536'],
            'from_gate' => ['required', 'exists:gates,id', 'different:to_gate'],
            'to_gate' => ['required', 'exists:gates,id'],
        ];
    }
}
