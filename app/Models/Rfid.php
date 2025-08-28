<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class Rfid extends Model
{
    protected $fillable = ['uid', 'key', 'pin', 'rfidable_type', 'rfidable_id'];

    public function rfidable(): MorphTo
    {
        return $this->morphTo();
    }

    #[Scope()]
    protected function whereUid(Builder $query, string $uid): void
    {
        $query->whereRaw("uid = decode(?, 'hex')", [$uid]);
    }

    protected function uid(): Attribute
    {
        return Attribute::make(
            get: fn($value) => Str::upper(bin2hex(stream_get_contents($value, 4))),
            set: fn($value) => DB::raw("decode('{$value}', 'hex')"),
        );
    }

    protected function key(): Attribute
    {
        return Attribute::make(
            get: fn($value) => Str::upper(bin2hex(stream_get_contents($value, 96))),
            set: fn($value) => DB::raw("decode('{$value}', 'hex')"),
        );
    }

    protected function casts(): array
    {
        return [
            'pin' => 'hashed',
        ];
    }
}
