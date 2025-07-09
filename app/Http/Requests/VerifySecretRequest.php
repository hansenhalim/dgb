<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VerifySecretRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'uid' => ['required', 'string', 'size:8', 'regex:/^[a-fA-F0-9]+/'],
            'secret_key' => ['required'],
        ];
    }

    public function messages(): array
    {
        return [
            'uid.regex' => 'UID must be a valid 8-character hexadecimal string.',
        ];
    }
}
