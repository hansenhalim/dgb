<?php

namespace App\Filament\Resources\Rfids\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class RfidsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')
                    ->label('ID'),
                TextColumn::make('uid_numeric')
                    ->label('UID'),
                IconColumn::make('pin')
                    ->label('Secured')
                    ->boolean()
                    ->trueIcon('heroicon-o-lock-closed')
                    ->falseIcon('heroicon-o-lock-open'),
                TextColumn::make('rfidable')
                    ->label('Linked To')
                    ->placeholder('Not Linked')
                    ->badge()
                    ->color(fn($record) => match ($record?->rfidable_type) {
                        'App\\Models\\Visit' => 'success',
                        'App\\Models\\Staff' => 'info',
                        default => 'gray',
                    })
                    ->formatStateUsing(function ($record) {
                        if (!$record->rfidable) {
                            return null;
                        }

                        return match ($record->rfidable_type) {
                            'App\\Models\\Visit' => $record->rfidable->vehicle_plate_number,
                            'App\\Models\\Staff' => $record->rfidable->name,
                            default => null,
                        };
                    })
                    ->searchable(query: function ($query, $search) {
                        $query->whereHasMorph('rfidable', ['App\\Models\\Visit', 'App\\Models\\Staff'], function ($query, $type) use ($search) {
                            if ($type === 'App\\Models\\Visit') {
                                $query->where('vehicle_plate_number', 'ilike', "%{$search}%");
                            } elseif ($type === 'App\\Models\\Staff') {
                                $query->where('name', 'ilike', "%{$search}%");
                            }
                        });
                    }),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
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
