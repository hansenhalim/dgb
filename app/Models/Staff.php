<?php

namespace App\Models;

use App\Enum\Role;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Laravel\Sanctum\HasApiTokens;

class Staff extends Model
{
    /** @use HasFactory<\Database\Factories\StaffFactory> */
    use HasApiTokens, HasFactory;

    protected function casts(): array
    {
        return [
            'role' => Role::class,
        ];
    }
}
