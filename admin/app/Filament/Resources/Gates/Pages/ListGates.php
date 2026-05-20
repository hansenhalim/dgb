<?php

namespace App\Filament\Resources\Gates\Pages;

use App\Filament\Resources\Gates\GateResource;
use Filament\Resources\Pages\ListRecords;

class ListGates extends ListRecords
{
    protected static string $resource = GateResource::class;

    protected function getHeaderActions(): array
    {
        return [
            //
        ];
    }
}
