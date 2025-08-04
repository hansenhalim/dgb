<?php

namespace App\Filament\Resources\Visits\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class VisitsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')->label('ID'),
                TextColumn::make('visitor_id'),
                // TextColumn::make('identity_photo'),
                TextColumn::make('vehicle_plate_number')->searchable(),
                TextColumn::make('purpose_of_visit')->searchable(),
                TextColumn::make('destination_name')->searchable(),
                TextColumn::make('checkin_at')->dateTime()->sortable(),
                TextColumn::make('checkin_gate_id')->numeric()->sortable(),
                TextColumn::make('checkout_at')->dateTime()->sortable(),
                TextColumn::make('checkout_gate_id')->numeric()->sortable(),
                TextColumn::make('current_position')->searchable(),
                TextColumn::make('created_at')->dateTime()->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('updated_at')->dateTime()->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('created_at', direction: 'desc')
            ->filters([
                //
            ])
            ->recordActions([
                ViewAction::make(),
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
