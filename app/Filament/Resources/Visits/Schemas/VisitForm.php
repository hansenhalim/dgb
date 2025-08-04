<?php

namespace App\Filament\Resources\Visits\Schemas;

use App\Enum\CurrentPosition;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class VisitForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('visitor_id'),
                // TextInput::make('identity_photo'),
                TextInput::make('vehicle_plate_number'),
                TextInput::make('purpose_of_visit'),
                TextInput::make('destination_name'),
                DateTimePicker::make('checkin_at'),
                TextInput::make('checkin_gate_id')->numeric(),
                DateTimePicker::make('checkout_at'),
                TextInput::make('checkout_gate_id')->numeric(),
                Select::make('current_position')->options(CurrentPosition::class)->required(),
            ]);
    }
}
