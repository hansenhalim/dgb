<?php

namespace App\Filament\Resources\Rfids\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Support\Facades\Log;

class RfidsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')
                    ->label('ID')
                    ->sortable(),

                TextColumn::make('uid')
                    ->label('UID')
                    ->searchable()
                    ->sortable(),

                TextColumn::make('rfidable_type')
                    ->label('Type')
                    ->formatStateUsing(fn($state) => class_basename($state))
                    ->sortable(),

                TextColumn::make('rfidable.name')
                    ->label('Person')
                    ->getStateUsing(function ($record) {
                        if ($record->rfidable_type === 'App\\Models\\Staff') {
                            return $record->rfidable?->name ?? 'Unknown Staff';
                        } elseif ($record->rfidable_type === 'App\\Models\\Visitor') {
                            return $record->rfidable?->identity_number ?? 'Unknown Visitor';
                        }

                        return 'Unknown';
                    })
                    ->searchable()
                    ->sortable(),

                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                //
            ])
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
