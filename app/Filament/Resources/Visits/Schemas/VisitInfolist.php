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
                                TextEntry::make('rfid.uid_numeric')
                                    ->label('RFID UID'),

                                TextEntry::make('visitor.fullname')
                                    ->label('Nama'),

                                TextEntry::make('vehicle_plate_number')
                                    ->label('Vehicle Plate Number'),

                                TextEntry::make('purpose_of_visit')
                                    ->label('Purpose of Visit'),

                                TextEntry::make('destination_name')
                                    ->label('Destination'),

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
                            ->formatStateUsing(fn () => 'Click to view photo')
                            ->badge()
                            ->color('success')
                            ->visible(fn () => in_array(
                                auth()->user()?->email,
                                ['superadmin@p3villacitra.com', 'fpsecond.hh@gmail.com']
                            ))
                            ->action(
                                \Filament\Actions\Action::make('viewPhoto')
                                    ->modalHeading('Identity Photo')
                                    ->modalContent(fn ($record) => view('filament.modals.identity-photo-viewer', [
                                        'photoUrl' => $record->getDecryptedIdentityPhotoUrl(),
                                    ]))
                                    ->modalSubmitAction(false)
                                    ->modalCancelActionLabel('Close')
                                    ->slideOver()
                            ),
                    ]),

                Section::make('Check-in/Check-out Details')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                TextEntry::make('checkin_at')
                                    ->label('Check-in Time')
                                    ->dateTime(),

                                TextEntry::make('checkinGate.name')
                                    ->label('Check-in Gate'),

                                TextEntry::make('checkout_at')
                                    ->label('Check-out Time')
                                    ->dateTime(),

                                TextEntry::make('checkoutGate.name')
                                    ->label('Check-out Gate'),

                                TextEntry::make('duration')
                                    ->label('Duration'),
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
