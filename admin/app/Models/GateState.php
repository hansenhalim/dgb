<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $name
 * @property int $base_quota
 * @property int $current_quota
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @mixin \Eloquent
 */
class GateState extends Model
{
    /**
     * Read-only: backed by the gate_states view, which takes the admin-owned
     * opening balance in gates.current_quota and replays every recorded card
     * movement on top of it — check-ins and check-outs counted through
     * visit_states, plus confirmed transfer_requests. current_quota here is
     * live stock; base_quota is the number an admin last typed. Nothing writes
     * this model; edits go through Gate.
     */
    protected $table = 'gate_states';

    public $incrementing = false;

    public $timestamps = false;
}
