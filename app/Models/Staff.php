<?php

namespace App\Models;

use App\Casts\AsSha256Hash;
use App\Enum\Role;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Laravel\Sanctum\HasApiTokens;

class Staff extends Model
{
    use HasApiTokens, HasUuids;

    protected function casts(): array
    {
        return [
            'role' => Role::class,
            'secret_key' => AsSha256Hash::class,
        ];
    }

    public function rfids(): MorphMany
    {
        return $this->morphMany(RFID::class, 'rfidable');
    }
}
