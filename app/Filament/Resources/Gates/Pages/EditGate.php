<?php

namespace App\Filament\Resources\Gates\Pages;

use App\Filament\Resources\Gates\GateResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditGate extends EditRecord
{
    protected static string $resource = GateResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
