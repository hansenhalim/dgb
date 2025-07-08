<?php

namespace App\Enum;

enum Position: string {
    case Villa1 = 'VIL_1';
    case Villa2 = 'VIL_2';
    case Exclusive = 'VIL_E';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}