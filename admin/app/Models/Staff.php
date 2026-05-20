<?php

namespace App\Models;

use App\Casts\AsSha256Hash;
use App\Enum\Role;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

/**
 * @property string $id
 * @property Role $role
 * @property string $name
 * @property string $secret_key
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Rfid|null $rfid
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PersonalAccessToken> $tokens
 * @property-read int|null $tokens_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Staff newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Staff newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Staff query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Staff whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Staff whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Staff whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Staff whereRole($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Staff whereSecretKey($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Staff whereUpdatedAt($value)
 * @mixin \Eloquent
 */
class Staff extends Authenticatable
{
    use HasApiTokens, HasUuids;

    protected $fillable = ['role', 'name', 'secret_key'];

    protected function casts(): array
    {
        return [
            'role' => Role::class,
            'secret_key' => AsSha256Hash::class,
        ];
    }

    public function rfid(): MorphOne
    {
        return $this->morphOne(Rfid::class, 'rfidable');
    }
}
