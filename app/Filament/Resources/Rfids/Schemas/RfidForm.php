<?php

namespace App\Filament\Resources\Rfids\Schemas;

use App\Models\Staff;
use App\Models\Visitor;
use Filament\Forms\Components\MorphToSelect;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Group;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class RfidForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('RFID Information')
                    ->schema([
                        Group::make([
                            TextInput::make('uid')
                                ->label('UID')
                                ->required()
                                ->maxLength(8)
                                ->rule('regex:/^[A-F0-9]{8}$/i')
                                ->placeholder('e.g. 12ABCDEF')
                                ->helperText('8-character hexadecimal UID'),
                        ])->columns(2),

                        TextInput::make('pin')
                            ->label('PIN')
                            ->password()
                            ->required()
                            ->maxLength(255)
                            ->helperText('PIN for RFID authentication'),
                    ]),

                Section::make('Associate with Person')
                    ->schema([
                        MorphToSelect::make('rfidable')
                            ->label('Person')
                            ->required()
                            ->types([
                                MorphToSelect\Type::make(Staff::class)
                                    ->titleAttribute('name'),
                                MorphToSelect\Type::make(Visitor::class)
                                    ->titleAttribute('identity_number'),
                            ]),
                    ]),
            ]);
    }
}
