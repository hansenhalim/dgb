<?php

namespace App\Filament\Resources\Gates;

use App\Filament\Resources\Gates\Pages\CreateGate;
use App\Filament\Resources\Gates\Pages\EditGate;
use App\Filament\Resources\Gates\Pages\ListGates;
use App\Filament\Resources\Gates\Schemas\GateForm;
use App\Filament\Resources\Gates\Tables\GatesTable;
use App\Models\Gate;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class GateResource extends Resource
{
    protected static ?string $model = Gate::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedHome;

    protected static ?string $recordTitleAttribute = 'name';

    public static function form(Schema $schema): Schema
    {
        return GateForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return GatesTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListGates::route('/'),
            'edit' => EditGate::route('/{record}/edit'),
        ];
    }
}
