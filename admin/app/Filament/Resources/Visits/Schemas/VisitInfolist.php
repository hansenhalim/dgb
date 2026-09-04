<?php

namespace App\Filament\Resources\Visits\Schemas;

use App\Enum\CurrentPosition;
use App\Enum\VisitAction;
use Filament\Actions\Action;
use Filament\Infolists\Components\RepeatableEntry;
use Filament\Infolists\Components\RepeatableEntry\TableColumn;
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
                                    ->color(fn (CurrentPosition $state): string => $state->color())
                                    ->formatStateUsing(fn (CurrentPosition $state): string => $state->label()),
                            ]),

                        TextEntry::make('identity_photo')
                            ->label('Identity Photo')
                            ->formatStateUsing(fn () => 'Click to view photo')
                            ->badge()
                            ->color('success')
                            ->visible(fn () => in_array(
                                auth()->user()?->email,
                                ['superadmin@p3villacitra.com', 'p3vc@p3villacitra.com']
                            ))
                            ->action(
                                Action::make('viewPhoto')
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

                Section::make('Visit Event')
                    ->columnSpanFull()
                    ->schema([
                        RepeatableEntry::make('visitEvents')
                            ->hiddenLabel()
                            ->placeholder('No events recorded for this visit.')
                            ->table([
                                TableColumn::make('Time'),
                                TableColumn::make('Action'),
                                TableColumn::make('Position'),
                                TableColumn::make('Gate'),
                                TableColumn::make('Guard'),
                            ])
                            ->schema([
                                TextEntry::make('created_at')
                                    ->dateTime(),

                                TextEntry::make('action')
                                    ->badge()
                                    ->color(fn (VisitAction $state): string => $state->color())
                                    ->formatStateUsing(fn (VisitAction $state): string => $state->label()),

                                TextEntry::make('current_position')
                                    ->badge()
                                    ->color(fn (CurrentPosition $state): string => $state->color())
                                    ->formatStateUsing(fn (CurrentPosition $state): string => $state->label()),

                                // Null on transitions backfilled from the
                                // pre-event-log schema, where no gate was stored.
                                TextEntry::make('gate.name')
                                    ->placeholder('—'),

                                // Null on every backfilled row: the operator was
                                // never recorded before the event log existed.
                                TextEntry::make('staff.name')
                                    ->placeholder('—'),
                            ]),
                    ]),
            ]);
    }
}
