<?php

namespace App\Filament\Resources\Visits\Tables;

use App\Enum\CurrentPosition;
use App\Filament\Exports\VisitExporter;
use Filament\Actions\ExportAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class VisitsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('nama')
                    ->getStateUsing(fn() => "-")
                    ->label('NAMA')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('vehicle_plate_number')
                    ->label('NO KENDARAAN')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('destination_name')
                    ->label('TUJUAN')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('purpose_of_visit')
                    ->label('KEPERLUAN')
                    ->searchable()
                    ->limit(30),
                TextColumn::make('current_position')
                    ->label('POSITION')
                    ->badge()
                    ->color(fn(CurrentPosition $state): string => match ($state) {
                        CurrentPosition::OUTSIDE => 'gray',
                        CurrentPosition::VILLA1 => 'success',
                        CurrentPosition::VILLA2 => 'info',
                        CurrentPosition::EXCLUSIVE => 'warning',
                        CurrentPosition::TRANSIT => 'danger',
                    })
                    ->formatStateUsing(fn(CurrentPosition $state): string => match ($state) {
                        CurrentPosition::OUTSIDE => 'Outside',
                        CurrentPosition::VILLA1 => 'Villa 1',
                        CurrentPosition::VILLA2 => 'Villa 2',
                        CurrentPosition::EXCLUSIVE => 'Exclusive',
                        CurrentPosition::TRANSIT => 'Transit',
                    }),
                TextColumn::make('checkin_at')
                    ->label('CHECK IN')
                    ->dateTime()
                    ->sortable(),
                TextColumn::make('checkinGate.name')
                    ->label('CHECK IN GATE')
                    ->sortable(),
                TextColumn::make('checkout_at')
                    ->label('CHECK OUT')
                    ->dateTime()
                    ->sortable(),
                TextColumn::make('checkoutGate.name')
                    ->label('CHECK OUT GATE')
                    ->sortable(),
                TextColumn::make('duration')
                    ->label('DURATION')
                    ->sortable(query: function ($query, string $direction): void {
                        $query->orderByRaw("COALESCE(checkout_at, NOW()) - checkin_at {$direction}");
                    }),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('current_position')
                    ->label('Current Position')
                    ->options([
                        CurrentPosition::OUTSIDE->value => 'Outside',
                        CurrentPosition::VILLA1->value => 'Villa 1',
                        CurrentPosition::VILLA2->value => 'Villa 2',
                        CurrentPosition::EXCLUSIVE->value => 'Exclusive Villa',
                        CurrentPosition::TRANSIT->value => 'Transit',
                    ]),

                SelectFilter::make('destination_name')
                    ->label('Destination')
                    ->relationship('destination', 'name'),
            ])
            ->recordActions([
                //
            ])
            ->toolbarActions([
                ExportAction::make()
                    ->exporter(VisitExporter::class),
            ])
            ->defaultSort('created_at', 'desc');
    }
}
