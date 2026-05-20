<?php

namespace App\Models;

use App\Enum\Status;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property Status $status
 * @property int $from_gate_id
 * @property int $to_gate_id
 * @property string $sender_staff_id
 * @property string|null $recipient_staff_id
 * @property int $amount
 * @property string|null $responded_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Gate $fromGate
 * @property-read \App\Models\Gate $toGate
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransferRequest newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransferRequest newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransferRequest query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransferRequest whereAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransferRequest whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransferRequest whereFromGateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransferRequest whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransferRequest whereRecipientStaffId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransferRequest whereRespondedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransferRequest whereSenderStaffId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransferRequest whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransferRequest whereToGateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransferRequest whereUpdatedAt($value)
 * @mixin \Eloquent
 */
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
