<?php

namespace App\Enum;

enum Role: string
{
    case GUARD = 'GRD';
    case MANAGER = 'MAN';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}