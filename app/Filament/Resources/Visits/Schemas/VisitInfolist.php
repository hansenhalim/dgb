<?php

namespace App\Filament\Resources\Visits\Schemas;

use App\Enum\CurrentPosition;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class VisitInfolist
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Visit Details')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                TextEntry::make('purpose_of_visit')
                                    ->label('Purpose of Visit'),

                                TextEntry::make('destination.name')
                                    ->label('Destination'),

                                TextEntry::make('vehicle_plate_number')
                                    ->label('Vehicle Plate Number'),

                                TextEntry::make('current_position')
                                    ->label('Current Position')
                                    ->badge()
                                    ->color(fn (CurrentPosition $state): string => match ($state) {
                                        CurrentPosition::OUTSIDE => 'gray',
                                        CurrentPosition::VILLA1 => 'success',
                                        CurrentPosition::VILLA2 => 'info',
                                        CurrentPosition::EXCLUSIVE => 'warning',
                                        CurrentPosition::TRANSIT => 'danger',
                                    })
                                    ->formatStateUsing(fn (CurrentPosition $state): string => match ($state) {
                                        CurrentPosition::OUTSIDE => 'Outside',
                                        CurrentPosition::VILLA1 => 'Villa 1',
                                        CurrentPosition::VILLA2 => 'Villa 2',
                                        CurrentPosition::EXCLUSIVE => 'Exclusive',
                                        CurrentPosition::TRANSIT => 'Transit',
                                    }),
                            ]),

                        TextEntry::make('identity_photo')
                            ->label('Identity Photo')
                            ->formatStateUsing(fn ($state): string => $state ? 'Photo available (binary data)' : 'No photo uploaded')
                            ->badge()
                            ->color(fn ($state): string => $state ? 'success' : 'gray'),
                    ]),

                Section::make('Check-in/Check-out Details')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                TextEntry::make('checkin_at')
                                    ->label('Check-in Time')
                                    ->dateTime(),

                                TextEntry::make('checkout_at')
                                    ->label('Check-out Time')
                                    ->dateTime(),

                                TextEntry::make('checkinGate.name')
                                    ->label('Check-in Gate'),

                                TextEntry::make('checkoutGate.name')
                                    ->label('Check-out Gate'),
                            ]),
                    ]),

                Section::make('System Information')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                TextEntry::make('created_at')
                                    ->label('Created At')
                                    ->dateTime(),

                                TextEntry::make('updated_at')
                                    ->label('Updated At')
                                    ->dateTime(),
                            ]),
                    ])
                    ->collapsible(),
            ]);
    }
}
