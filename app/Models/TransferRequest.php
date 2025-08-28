<?php

namespace App\Models;

use App\Enum\Status;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TransferRequest extends Model
{
    protected function casts(): array
    {
        return [
            'status' => Status::class,
        ];
    }

    public function fromGate(): BelongsTo
    {
        return $this->belongsTo(Gate::class);
    }

    public function toGate(): BelongsTo
    {
        return $this->belongsTo(Gate::class);
    }
}
