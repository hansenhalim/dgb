<?php

namespace App\Enum;

enum Position: string
{
    case VILLA1 = 'VIL_1';
    case VILLA2 = 'VIL_2';
    case EXCLUSIVE = 'VIL_E';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function human(): string
    {
        return match ($this) {
            Position::VILLA1 => 'VILLA 1',
            Position::VILLA2 => 'VILLA 2',
            Position::EXCLUSIVE => 'EXCLUSIVE',
        };
    }
}