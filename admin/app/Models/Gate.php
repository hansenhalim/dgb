<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property int $id
 * @property string $name
 * @property int $current_quota
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\GateState|null $state
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Gate newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Gate newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Gate query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Gate whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Gate whereCurrentQuota($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Gate whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Gate whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Gate whereUpdatedAt($value)
 * @mixin \Eloquent
 */
class Gate extends Model
{
    protected $fillable = [
        'name',
        'current_quota',
    ];

    /**
     * Live card stock, derived by the gate_states view. This admin is the only
     * writer of gates.current_quota, which the view treats as an opening
     * balance; every subsequent movement is replayed from visit_states and
     * confirmed transfer_requests. Read stock through here, never off the
     * base column.
     */
    public function state(): HasOne
    {
        return $this->hasOne(GateState::class, 'id', 'id');
    }
}
