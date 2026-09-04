<?php

namespace App\Enum;

use Illuminate\Support\Collection;

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

    /**
     * Value => label map for select inputs and filters.
     *
     * @return array<string, string>
     */
    public static function options(): array
    {
        return Collection::make(self::cases())
            ->mapWithKeys(fn (self $case): array => [$case->value => $case->label()])
            ->all();
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

    /**
     * Human label shown wherever a position is rendered: table badges, infolist
     * badges, and the position filter. Single source of truth for all three.
     */
    public function label(): string
    {
        return match ($this) {
            self::OUTSIDE => 'Outside',
            self::VILLA1 => 'Villa 1',
            self::VILLA2 => 'Villa 2',
            self::EXCLUSIVE => 'Exclusive',
            self::TRANSIT => 'Transit',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::OUTSIDE => 'gray',
            self::VILLA1 => 'success',
            self::VILLA2 => 'info',
            self::EXCLUSIVE => 'warning',
            self::TRANSIT => 'danger',
        };
    }

    public function formatName(): string
    {
        return match ($this) {
            self::VILLA1 => 'VILLA 1',
            self::VILLA2 => 'VILLA 2',
            self::EXCLUSIVE => 'EXCLUSIVE',
            self::OUTSIDE => 'OUTSIDE',
            self::TRANSIT => 'TRANSIT',
        };
    }
}
