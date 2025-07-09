<?php

namespace App\Models;

use App\Enum\Role;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Staff extends Model
{
    /** @use HasFactory<\Database\Factories\StaffFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'role' => Role::class,
        ];
    }
}
