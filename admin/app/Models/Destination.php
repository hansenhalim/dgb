<?php

namespace App\Models;

use App\Enum\Position;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $name
 * @property Position $position
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Destination newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Destination newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Destination query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Destination whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Destination whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Destination wherePosition($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Destination whereUpdatedAt($value)
 * @mixin \Eloquent
 */
class Destination extends Model
{
    protected $primaryKey = 'name';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'name',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'position' => Position::class,
        ];
    }
}
