<?php

namespace App\Filament\Resources\Gates\Schemas;

use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class GateForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('name')
                    ->required(),
                // Opening balance, not live stock: the gate_states view adds
                // every check-in, check-out and confirmed transfer on top of
                // this number. Editing it shifts the whole derived series, so
                // correcting a drawer recount means entering the difference,
                // not the count.
                TextInput::make('current_quota')
                    ->label('Opening balance')
                    ->helperText('Starting card count. Live stock is this plus every recorded check-in, check-out and confirmed transfer.')
                    ->required()
                    ->numeric(),
            ]);
    }
}
