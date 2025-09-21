<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Visitor extends Model
{
    use HasUuids;

    protected $fillable = ['identity_number', 'banned_at', 'banned_reason'];

    protected function casts(): array
    {
        return [
            'banned_at' => 'datetime',
        ];
    }

    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class);
    }
}
