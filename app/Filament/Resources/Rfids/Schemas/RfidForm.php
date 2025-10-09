<?php

namespace App\Filament\Resources\Rfids\Schemas;

use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class RfidForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('uid')
                    ->required(),
                TextInput::make('key')
                    ->required(),
                TextInput::make('pin'),
                TextInput::make('rfidable_type'),
                TextInput::make('rfidable_id'),
            ]);
    }
}
