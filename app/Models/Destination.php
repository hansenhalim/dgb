<?php

namespace App\Models;

use App\Enum\Position;
use Illuminate\Database\Eloquent\Model;

class Destination extends Model
{
    protected function casts(): array
    {
        return [
            'position' => Position::class,
        ];
    }
}
