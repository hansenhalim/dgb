<?php

namespace App\Enum;

/**
 * A gate transition recorded in the append-only visit_events log. Mirrors the
 * visit_events_action_check constraint; the Go API models the same set as an
 * int enum but persists these string values.
 */
enum VisitAction: string
{
    case CHECKIN = 'CHECKIN';
    case CHECKOUT = 'CHECKOUT';
    case TRANSIT = 'TRANSIT';
    case TRANSIT_ENTER = 'TRANSIT_ENTER';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return match ($this) {
            self::CHECKIN => 'Check-in',
            self::CHECKOUT => 'Check-out',
            self::TRANSIT => 'Transit',
            self::TRANSIT_ENTER => 'Transit Enter',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::CHECKIN => 'success',
            self::CHECKOUT => 'gray',
            self::TRANSIT => 'danger',
            self::TRANSIT_ENTER => 'info',
        };
    }
}
