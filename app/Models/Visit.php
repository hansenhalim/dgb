<?php

namespace App\Models;

use App\Enum\CurrentPosition;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphOne;

class Visit extends Model
{
    use HasUuids;

    protected $fillable = [
        'visitor_id',
        'identity_photo',
        'vehicle_plate_number',
        'purpose_of_visit',
        'destination_name',
        'checkin_at',
        'checkin_gate_id',
        'checkout_at',
        'checkout_gate_id',
        'current_position',
    ];

    protected function casts(): array
    {
        return [
            'checkin_at' => 'datetime',
            'checkout_at' => 'datetime',
            'current_position' => CurrentPosition::class,
        ];
    }

    public function visitor(): BelongsTo
    {
        return $this->belongsTo(Visitor::class);
    }

    public function destination(): BelongsTo
    {
        return $this->belongsTo(Destination::class, 'destination_name', 'name');
    }

    public function checkinGate(): BelongsTo
    {
        return $this->belongsTo(Gate::class, 'checkin_gate_id');
    }

    public function checkoutGate(): BelongsTo
    {
        return $this->belongsTo(Gate::class, 'checkout_gate_id');
    }

    public function rfid(): MorphOne
    {
        return $this->morphOne(Rfid::class, 'rfidable');
    }
}
