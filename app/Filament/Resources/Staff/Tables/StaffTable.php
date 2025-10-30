<?php

namespace App\Filament\Resources\Staff\Tables;

use App\Enum\Role;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class StaffTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')
                    ->label('ID'),
                TextColumn::make('role')
                    ->badge()
                    ->color(fn (Role $state): string => match ($state) {
                        Role::GUARD => 'info',
                        Role::MANAGER => 'success',
                    })
                    ->formatStateUsing(fn (Role $state): string => match ($state) {
                        Role::GUARD => 'Guard',
                        Role::MANAGER => 'Manager',
                    })
                    ->searchable(),
                TextColumn::make('name')
                    ->searchable(),
                // TextColumn::make('secret_key')
                //     ->searchable(),
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
