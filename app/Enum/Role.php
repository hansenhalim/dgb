<?php

namespace App\Enum;

enum Role: string
{
    case Guard = 'GRD';
    case Manager = 'MAN';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}