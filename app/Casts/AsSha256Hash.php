<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsInboundAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class AsSha256Hash implements CastsInboundAttributes
{
    public function set(
        Model $model,
        string $key,
        mixed $value,
        array $attributes,
    ): string {
        return Str::of(hex2bin($value))->hash('sha256');
    }
}