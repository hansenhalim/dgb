<?php

namespace App\Models;

use App\Enum\CurrentPosition;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Visit extends Model
{
    use HasUuids;

    protected $fillable = [
        'identity_photo',
        'vehicle_plate_number',
        'purpose_of_visit',
        'destination_name',
        'current_position',
    ];

    protected function casts(): array
    {
        return [
            'current_position' => CurrentPosition::class,
        ];
    }

    public function destination(): BelongsTo
    {
        return $this->belongsTo(Destination::class);
    }
}
