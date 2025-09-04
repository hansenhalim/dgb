<?php

namespace App\Filament\Resources\Destinations\Schemas;

use App\Enum\Position;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class DestinationForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('name')
                    ->required()
                    ->maxLength(255)
                    ->unique(ignoreRecord: true),

                Select::make('position')
                    ->required()
                    ->options([
                        Position::VILLA1->value => Position::VILLA1->human(),
                        Position::VILLA2->value => Position::VILLA2->human(),
                        Position::EXCLUSIVE->value => Position::EXCLUSIVE->human(),
                    ]),
            ]);
    }
}
