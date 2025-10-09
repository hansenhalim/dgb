<?php

namespace App\Filament\Resources\Rfids;

use App\Filament\Resources\Rfids\Pages\CreateRfid;
use App\Filament\Resources\Rfids\Pages\EditRfid;
use App\Filament\Resources\Rfids\Pages\ListRfids;
use App\Filament\Resources\Rfids\Pages\ViewRfid;
use App\Filament\Resources\Rfids\Schemas\RfidForm;
use App\Filament\Resources\Rfids\Schemas\RfidInfolist;
use App\Filament\Resources\Rfids\Tables\RfidsTable;
use App\Models\Rfid;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class RfidResource extends Resource
{
    protected static ?string $model = Rfid::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?string $recordTitleAttribute = 'uid';

    public static function form(Schema $schema): Schema
    {
        return RfidForm::configure($schema);
    }

    public static function infolist(Schema $schema): Schema
    {
        return RfidInfolist::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return RfidsTable::configure($table);
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
            'index' => ListRfids::route('/'),
            'create' => CreateRfid::route('/create'),
            'view' => ViewRfid::route('/{record}'),
        ];
    }
}
