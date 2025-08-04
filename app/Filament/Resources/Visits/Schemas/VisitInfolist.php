<?php

namespace App\Filament\Resources\Visits\Schemas;

use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Schema;

class VisitInfolist
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextEntry::make('id')
                    ->label('ID'),
                TextEntry::make('visitor_id'),
                // TextEntry::make('identity_photo'),
                TextEntry::make('vehicle_plate_number'),
                TextEntry::make('purpose_of_visit'),
                TextEntry::make('destination_name'),
                TextEntry::make('checkin_at')
                    ->dateTime(),
                TextEntry::make('checkin_gate_id')
                    ->numeric(),
                TextEntry::make('checkout_at')
                    ->dateTime(),
                TextEntry::make('checkout_gate_id')
                    ->numeric(),
                TextEntry::make('current_position'),
                TextEntry::make('created_at')
                    ->dateTime(),
                TextEntry::make('updated_at')
                    ->dateTime(),
            ]);
    }
}
