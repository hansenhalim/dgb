<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Gate extends Model
{
    public function transferRequest(): HasOne
    {
        return $this->hasOne(TransferRequest::class, 'to_gate_id')->oldestOfMany();
    }
}
