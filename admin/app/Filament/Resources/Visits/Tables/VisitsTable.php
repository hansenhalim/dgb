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
                TextColumn::make('visitor.fullname')
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
                    ->color(fn (CurrentPosition $state): string => $state->color())
                    ->formatStateUsing(fn (CurrentPosition $state): string => $state->label()),
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
                    ->options(CurrentPosition::options()),

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
