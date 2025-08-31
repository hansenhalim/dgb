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

    public static function getCheckinPosition(int $gateId): self
    {
        return match ($gateId) {
            1, 2 => self::VILLA1,
            3 => self::VILLA2,
        };
    }

    public static function getCheckoutPosition(int $gateId): self
    {
        return match ($gateId) {
            1, 2, 3 => self::OUTSIDE,
        };
    }

    public static function getTransitPosition(int $gateId): self
    {
        return match ($gateId) {
            2, 3 => self::TRANSIT,
            4 => self::VILLA2,
        };
    }

    public static function getTransitEnterPosition(int $gateId): self
    {
        return match ($gateId) {
            2 => self::VILLA1,
            3 => self::VILLA2,
            4 => self::EXCLUSIVE,
        };
    }

    public function formatName(): string
    {
        return match ($this) {
            self::VILLA1 => 'VILLA 1',
            self::VILLA2 => 'VILLA 2',
            self::EXCLUSIVE => 'VILLA EXCLUSIVE',
            self::OUTSIDE => 'OUTSIDE',
            self::TRANSIT => 'TRANSIT',
        };
    }
}