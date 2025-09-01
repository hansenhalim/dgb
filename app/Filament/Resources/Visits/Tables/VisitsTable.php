<?php

namespace App\Filament\Resources\Visits\Tables;

use App\Enum\CurrentPosition;
use App\Filament\Exports\VisitExporter;
use Filament\Actions\ExportAction;
use Filament\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class VisitsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('identity_photo')
                    ->label('Photo')
                    ->formatStateUsing(fn ($state): string => $state ? 'Available' : 'No photo')
                    ->badge()
                    ->color(fn ($state): string => $state ? 'success' : 'gray'),

                TextColumn::make('purpose_of_visit')
                    ->label('Purpose')
                    ->searchable()
                    ->limit(30),

                TextColumn::make('destination.name')
                    ->label('Destination')
                    ->searchable()
                    ->sortable(),

                TextColumn::make('current_position')
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

                TextColumn::make('checkin_at')
                    ->label('Check-in')
                    ->dateTime()
                    ->sortable(),

                TextColumn::make('checkout_at')
                    ->label('Check-out')
                    ->dateTime()
                    ->sortable(),

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
                ViewAction::make(),
            ])
            ->toolbarActions([
                ExportAction::make()
                    ->exporter(VisitExporter::class),
            ])
            ->defaultSort('created_at', 'desc');
    }
}
