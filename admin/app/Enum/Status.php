<?php

namespace App\Enum;

enum Status: string
{
    case PENDING = 'PEND';
    case CONFIRMED = 'CFRM';
    case REJECTED = 'RJCT';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function respond(): string
    {
        return match ($this) {
            Status::CONFIRMED => 'confirmed',
            Status::REJECTED => 'rejected',
        };
    }
}