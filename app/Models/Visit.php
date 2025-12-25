<?php

namespace App\Models;

use App\Enum\CurrentPosition;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;

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

    protected function duration(): Attribute
    {
        return Attribute::make(
            get: function () {
                if (!$this->checkin_at) {
                    return '-';
                }

                $checkout = $this->checkout_at ?? now();
                $diff = $this->checkin_at->diff($checkout);

                // Calculate total days including years and months
                $totalDays = $diff->y * 365 + $diff->m * 30 + $diff->d;

                $parts = [];
                if ($totalDays > 0) {
                    $parts[] = "{$totalDays}d";
                }
                if ($diff->h > 0) {
                    $parts[] = "{$diff->h}h";
                }
                if ($diff->i > 0) {
                    $parts[] = "{$diff->i}m";
                }

                return !empty($parts) ? implode(' ', $parts) : '0m';
            }
        );
    }

    public function getDecryptedIdentityPhotoUrl(): ?string
    {
        if (!$this->identity_photo) {
            return null;
        }

        $context = $this->buildAuditContext();

        Log::info('Identity photo decryption attempted', $context);

        try {
            $encryptedData = $this->identity_photo;
            $encryptedData = stream_get_contents($encryptedData);
            $decrypted = Crypt::decrypt($encryptedData);
            $base64 = base64_encode($decrypted);

            Log::info('Identity photo decryption successful', array_merge($context, [
                'data_size_bytes' => strlen($decrypted),
            ]));

            return "data:image/jpeg;base64,{$base64}";
        } catch (\Exception $e) {
            Log::error('Identity photo decryption failed', array_merge($context, [
                'error_message' => $e->getMessage(),
                'error_type' => get_class($e),
                'trace' => $e->getTraceAsString(),
            ]));

            return null;
        }
    }

    protected function buildAuditContext(): array
    {
        $context = [
            'visit_id' => $this->id,
            'visitor_id' => $this->visitor_id,
            'checkin_at' => $this->checkin_at?->toIso8601String(),
            'current_position' => $this->current_position?->value,
        ];

        if (auth()->check()) {
            $context['authenticated_user_id'] = auth()->id();
            $context['authenticated_user_email'] = auth()->user()?->email;
        }

        if (request()) {
            $context['ip_address'] = request()->ip();
            $context['user_agent'] = request()->userAgent();
            $context['request_url'] = request()->fullUrl();
        }

        return $context;
    }
}
