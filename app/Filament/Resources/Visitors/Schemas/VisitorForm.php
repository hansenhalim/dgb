<?php

namespace App\Filament\Resources\Visitors\Schemas;

use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class VisitorForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('identity_number')
                    ->required(),
                DateTimePicker::make('banned_at'),
                TextInput::make('banned_reason'),
            ]);
    }
}
