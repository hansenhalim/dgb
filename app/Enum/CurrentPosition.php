<?php

namespace App\Enum;

enum CurrentPosition: string
{
    case Outside = 'OUT';
    case Villa1 = 'VIL_1';
    case Villa2 = 'VIL_2';
    case Exclusive = 'VIL_E';
    case InTransit = 'TRNST';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}