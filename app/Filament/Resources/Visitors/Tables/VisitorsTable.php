<?php

namespace App\Filament\Resources\Visitors\Tables;

use Filament\Actions\Action;
use Filament\Notifications\Notification;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class VisitorsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')
                    ->label('ID'),
                TextColumn::make('identity_number')
                    ->label('Identity Number')
                    ->searchable(query: function ($query, $search) {
                        if (strlen($search) === 16 && ctype_digit($search)) {
                            $hashedSearch = Str::of($search)->hash('sha256');
                            return $query->where('identity_number', $hashedSearch);
                        }
                        return $query;
                    })
                    ->formatStateUsing(fn() => '****************'),
                TextColumn::make('banned_at')
                    ->dateTime()
                    ->sortable(),
                TextColumn::make('banned_reason')
                    ->searchable(),
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
                Action::make('removeBan')
                    ->label('Remove Ban')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->visible(fn($record) => $record->banned_at !== null)
                    ->requiresConfirmation()
                    ->modalHeading('Remove Ban')
                    ->modalDescription('Are you sure you want to remove the ban from this visitor?')
                    ->action(function ($record) {
                        $record->update(['banned_at' => null, 'banned_reason' => null]);

                        Notification::make()
                            ->title('Ban removed successfully')
                            ->success()
                            ->send();
                    }),
            ])
            ->toolbarActions([
                //
            ]);
    }
}
