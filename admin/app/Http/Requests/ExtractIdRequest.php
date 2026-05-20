<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ExtractIdRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('fields'))) {
            $this->merge([
                'fields' => array_values(array_filter(array_map('trim', explode(',', $this->input('fields'))))),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'image' => ['required', 'file', 'image', 'max:1024'],
            'fields' => ['sometimes', 'array'],
            'fields.*' => ['string'],
        ];
    }

    public function messages(): array
    {
        return [
            'image.max' => 'Image exceeds 1MB limit.',
        ];
    }
}
