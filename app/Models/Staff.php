<?php

namespace App\Models;

use App\Casts\AsSha256Hash;
use App\Enum\Role;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Staff extends Authenticatable
{
    use HasApiTokens, HasUuids;

    protected function casts(): array
    {
        return [
            'role' => Role::class,
            'secret_key' => AsSha256Hash::class,
        ];
    }

    public function rfid(): MorphOne
    {
        return $this->morphOne(Rfid::class, 'rfidable');
    }
}
