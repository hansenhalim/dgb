<?php

namespace App\Models;

use App\Enum\Status;
use Illuminate\Database\Eloquent\Model;

class TransferRequest extends Model
{
    protected function casts(): array
    {
        return [
            'status' => Status::class,
        ];
    }
}
