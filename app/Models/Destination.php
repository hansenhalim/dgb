<?php

namespace App\Models;

use App\Enum\Position;
use Illuminate\Database\Eloquent\Model;

class Destination extends Model
{
    protected $primaryKey = 'name';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'name',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'position' => Position::class,
        ];
    }
}
