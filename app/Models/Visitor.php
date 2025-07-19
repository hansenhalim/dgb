<?php

namespace App\Models;

use App\Casts\AsSha256Hash;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Visitor extends Model
{
    use HasUuids;

    protected function casts(): array
    {
        return [
            'identity_number' => AsSha256Hash::class,
        ];
    }
}
