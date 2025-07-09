<?php

namespace App\Models;

use App\Enum\CurrentPosition;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Visit extends Model
{
    /** @use HasFactory<\Database\Factories\VisitFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'current_position' => CurrentPosition::class,
        ];
    }
}
