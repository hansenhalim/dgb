<?php

namespace App\Filament\Resources\Visitors\Schemas;

use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class VisitorInfolist
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Visitor Information')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                TextEntry::make('identity_number')
                                    ->label('Identity Number')
                                    ->formatStateUsing(fn () => '****************'),

                                TextEntry::make('fullname'),
                            ]),
                    ]),

                Section::make('Ban Status')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                TextEntry::make('banned_at')
                                    ->label('Banned At')
                                    ->dateTime()
                                    ->badge()
                                    ->color(fn ($state): string => $state ? 'danger' : 'success')
                                    ->formatStateUsing(fn ($state): string => $state ? $state->format('M j, Y g:i A') : 'Not Banned'),

                                TextEntry::make('banned_reason')
                                    ->label('Ban Reason')
                                    ->formatStateUsing(fn ($state): string => $state ?: 'No ban reason')
                                    ->badge()
                                    ->color(fn ($state): string => $state ? 'danger' : 'gray'),
                            ]),
                    ])
                    ->visible(fn ($record): bool => $record->banned_at !== null),

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
