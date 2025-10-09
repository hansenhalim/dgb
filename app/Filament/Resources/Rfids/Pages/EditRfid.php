<?php

namespace App\Filament\Resources\Rfids\Pages;

use App\Filament\Resources\Rfids\RfidResource;
use Filament\Actions\DeleteAction;
use Filament\Actions\ViewAction;
use Filament\Resources\Pages\EditRecord;

class EditRfid extends EditRecord
{
    protected static string $resource = RfidResource::class;

    protected function getHeaderActions(): array
    {
        return [
            ViewAction::make(),
            DeleteAction::make(),
        ];
    }
}
