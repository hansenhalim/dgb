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
                TextInput::make('current_quota')
                    ->required()
                    ->numeric(),
            ]);
    }
}
