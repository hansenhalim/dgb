<?php

namespace App\Enum;

enum CurrentPosition: string
{
    case OUTSIDE = 'OUT';
    case VILLA1 = 'VIL_1';
    case VILLA2 = 'VIL_2';
    case EXCLUSIVE = 'VIL_E';
    case TRANSIT = 'TRNST';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}