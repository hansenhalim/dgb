<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uid
 * @property string $key
 * @property string|null $pin
 * @property string|null $rfidable_type
 * @property string|null $rfidable_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read Model|\Eloquent|null $rfidable
 * @property-read mixed $uid_numeric
 * @method static Builder<static>|Rfid newModelQuery()
 * @method static Builder<static>|Rfid newQuery()
 * @method static Builder<static>|Rfid query()
 * @method static Builder<static>|Rfid whereCreatedAt($value)
 * @method static Builder<static>|Rfid whereId($value)
 * @method static Builder<static>|Rfid whereKey($value)
 * @method static Builder<static>|Rfid wherePin($value)
 * @method static Builder<static>|Rfid whereRfidableId($value)
 * @method static Builder<static>|Rfid whereRfidableType($value)
 * @method static Builder<static>|Rfid whereUid($value)
 * @method static Builder<static>|Rfid whereUpdatedAt($value)
 * @mixin \Eloquent
 */
class Rfid extends Model
{
    protected $fillable = ['uid', 'key', 'pin', 'rfidable_type', 'rfidable_id'];

    public function rfidable(): MorphTo
    {
        return $this->morphTo();
    }

    #[Scope()]
    protected function whereUid(Builder $query, string $uid): void
    {
        $query->whereRaw("uid = decode(?, 'hex')", [$uid]);
    }

    protected function uid(): Attribute
    {
        return Attribute::make(
            get: function ($value) {
                rewind($value);

                return Str::upper(bin2hex(stream_get_contents($value, 4)));
            },
            set: fn ($value) => DB::raw("decode('{$value}', 'hex')"),
        );
    }

    protected function key(): Attribute
    {
        return Attribute::make(
            get: function ($value) {
                rewind($value);

                return Str::upper(bin2hex(stream_get_contents($value, 96)));
            },
            set: fn ($value) => DB::raw("decode('{$value}', 'hex')"),
        );
    }

    protected function uidNumeric(): Attribute
    {
        return Attribute::make(
            get: function () {
                $hexUid = $this->uid;

                $swapped = implode('', array_reverse(str_split($hexUid, 2)));
                $decimal = hexdec($swapped);

                return str_pad((string) $decimal, 10, '0', STR_PAD_LEFT);
            },
        );
    }

    protected function casts(): array
    {
        return [
            'pin' => 'hashed',
        ];
    }
}
