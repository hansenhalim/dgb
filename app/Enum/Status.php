<?php

namespace App\Enum;

enum Status: string
{
    case Pending = 'PEND';
    case Confirmed = 'CFRM';
    case Rejected = 'RJCT';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}