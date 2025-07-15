<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class RFID extends Model
{
    protected $table = 'rfids';

    public function rfidable(): MorphTo
    {
        return $this->morphTo();
    }

    #[Scope()]
    protected function whereUID(Builder $query, string $uid): void
    {
        $query->whereRaw("uid = decode(?, 'hex')", [$uid]);
    }

    protected function casts(): array
    {
        return [
            'pin' => 'hashed',
        ];
    }
}
