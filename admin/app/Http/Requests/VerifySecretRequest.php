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
            'uid' => ['required', 'string', 'size:8', 'regex:/^[A-F0-9]+$/'],
            'secret_key' => ['required', 'string', 'size:1024', 'regex:/^[A-F0-9]+$/'],
            'device_name' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'uid.regex' => 'UID must be a valid 8-character hexadecimal string.',
            'secret_key.regex' => 'Secret Key must be a valid 1024-character hexadecimal string.',
        ];
    }
}
