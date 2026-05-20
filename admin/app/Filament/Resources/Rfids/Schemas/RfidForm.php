<?php

namespace App\Filament\Resources\Rfids\Schemas;

use App\Models\Staff;
use App\Models\Visit;
use Filament\Forms\Components\MorphToSelect;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class RfidForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                MorphToSelect::make('rfidable')
                    ->label('Linked To')
                    ->types([
                        MorphToSelect\Type::make(Staff::class)
                            ->titleAttribute('name'),
                        MorphToSelect\Type::make(Visit::class)
                            ->titleAttribute('vehicle_plate_number'),
                    ])
                    ->searchable()
                    ->preload(),
                TextInput::make('pin')
                    ->password()
                    ->length(6)
                    ->regex('/^\d{6}$/')
                    ->dehydrated(fn (?string $state): bool => filled($state))
                    ->formatStateUsing(fn (): string => ''),
            ]);
    }
}
