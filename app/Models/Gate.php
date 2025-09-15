<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Gate extends Model
{
    protected $fillable = [
        'name',
        'current_quota',
    ];
}
