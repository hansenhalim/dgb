<?php

namespace App\Filament\Imports;

use App\Models\Destination;
use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;

class DestinationImporter extends Importer
{
    protected static ?string $model = Destination::class;

    public static function getColumns(): array
    {
        return [
            ImportColumn::make('name')
                ->requiredMapping()
                ->rules(['required', 'max:255']),
            ImportColumn::make('position')
                ->requiredMapping()
                ->rules(['required', 'in:VIL_1,VIL_2,VIL_E']),
        ];
    }

    public function resolveRecord(): Destination
    {
        return Destination::firstOrNew([
            'name' => $this->data['name'],
        ]);
    }


    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your destination import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

        if ($failedRowsCount = $import->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to import.';
        }

        return $body;
    }
}
