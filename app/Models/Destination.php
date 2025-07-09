<?php

namespace App\Models;

use App\Enum\Position;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Destination extends Model
{
    /** @use HasFactory<\Database\Factories\DestinationFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'position' => Position::class,
        ];
    }
}
