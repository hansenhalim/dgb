<?php

namespace App\Filament\Exports;

use App\Models\Visit;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Number;

class VisitExporter extends Exporter
{
    protected static ?string $model = Visit::class;

    public static function getColumns(): array
    {
        return [
            ExportColumn::make('id')
                ->label('ID'),
            ExportColumn::make('visitor.name')
                ->label('Visitor Name'),
            ExportColumn::make('visitor.phone')
                ->label('Visitor Phone'),
            ExportColumn::make('identity_photo')
                ->label('Has Photo')
                ->formatStateUsing(fn ($state): string => $state ? 'Yes' : 'No'),
            ExportColumn::make('vehicle_plate_number')
                ->label('Vehicle Plate'),
            ExportColumn::make('purpose_of_visit')
                ->label('Purpose of Visit'),
            ExportColumn::make('destination.name')
                ->label('Destination'),
            ExportColumn::make('current_position')
                ->label('Current Position')
                ->formatStateUsing(fn ($state): string => match ($state?->value) {
                    'outside' => 'Outside',
                    'villa1' => 'Villa 1',
                    'villa2' => 'Villa 2',
                    'exclusive' => 'Exclusive',
                    'transit' => 'Transit',
                    default => $state?->value ?? 'Unknown',
                }),
            ExportColumn::make('checkin_at')
                ->label('Check-in Time'),
            ExportColumn::make('checkinGate.name')
                ->label('Check-in Gate'),
            ExportColumn::make('checkout_at')
                ->label('Check-out Time'),
            ExportColumn::make('checkoutGate.name')
                ->label('Check-out Gate'),
            ExportColumn::make('created_at')
                ->label('Created At'),
            ExportColumn::make('updated_at')
                ->label('Updated At'),
        ];
    }

    public static function modifyQuery(Builder $query): Builder
    {
        return $query->with(['visitor', 'destination', 'checkinGate', 'checkoutGate']);
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your visit export has completed and '.Number::format($export->successful_rows).' '.str('row')->plural($export->successful_rows).' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' '.Number::format($failedRowsCount).' '.str('row')->plural($failedRowsCount).' failed to export.';
        }

        return $body;
    }
}
