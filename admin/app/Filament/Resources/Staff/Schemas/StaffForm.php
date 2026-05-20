<?php

namespace App\Filament\Resources\Staff\Schemas;

use App\Enum\Role;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class StaffForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('role')
                    ->options(Role::class)
                    ->required(),
                TextInput::make('name')
                    ->required(),
            ]);
    }
}
