<?php

namespace App\Models;

use App\Enum\Status;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TransferRequest extends Model
{
    /** @use HasFactory<\Database\Factories\TransferRequestFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'status' => Status::class,
        ];
    }
}
