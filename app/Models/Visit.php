<?php

namespace App\Models;

use App\Enum\CurrentPosition;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Visit extends Model
{
    use HasUuids;

    protected function casts(): array
    {
        return [
            'current_position' => CurrentPosition::class,
        ];
    }
}
