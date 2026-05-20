<?php

namespace App\Filament\Widgets;

use App\Models\Visit;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Facades\DB;

class PeakVisitTimeChart extends ChartWidget
{
    protected static ?int $sort = 3;

    protected ?string $heading = 'Peak Visit Time Chart';

    public ?string $filter;

    public function mount(): void
    {
        $this->filter = strtolower(now()->englishDayOfWeek);
    }

    protected function getData(): array
    {
        // Map filter to day of week number (1 = Monday, 7 = Sunday)
        $dayMapping = [
            'monday' => 1,
            'tuesday' => 2,
            'wednesday' => 3,
            'thursday' => 4,
            'friday' => 5,
            'saturday' => 6,
            'sunday' => 0,
        ];

        $dayOfWeek = $dayMapping[$this->filter];

        // Query average visits per hour for the selected day of week (Asia/Jakarta timezone)
        // First, get total count per hour and count of unique days
        $totalDays = Visit::query()
            ->whereNotNull('checkin_at')
            ->whereRaw("EXTRACT(DOW FROM (checkin_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')) = ?", [$dayOfWeek])
            ->selectRaw("COUNT(DISTINCT DATE(checkin_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')) as day_count")
            ->value('day_count') ?: 1;

        $hourlyVisitCounts = Visit::query()
            ->whereNotNull('checkin_at')
            ->whereRaw("EXTRACT(DOW FROM (checkin_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')) = ?", [$dayOfWeek])
            ->select(
                DB::raw("EXTRACT(HOUR FROM (checkin_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')) as hour"),
                DB::raw("ROUND(CAST(COUNT(*) AS DECIMAL) / {$totalDays}) as avg_count")
            )
            ->groupBy('hour')
            ->orderBy('hour')
            ->pluck('avg_count', 'hour');

        // Dummy data for different days (visits per hour 0-23)
        // $weekdayData = [
        //     'monday' => [4, 3, 2, 1, 1, 2, 5, 10, 15, 20, 25, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 5],
        //     'tuesday' => [1, 0, 0, 0, 2, 4, 10, 18, 26, 30, 34, 38, 32, 30, 27, 24, 28, 32, 26, 20, 14, 10, 6, 4],
        //     'wednesday' => [2, 1, 0, 1, 2, 5, 12, 20, 28, 32, 36, 40, 35, 32, 29, 26, 30, 34, 28, 22, 16, 12, 7, 5],
        //     'thursday' => [1, 1, 0, 0, 1, 4, 9, 17, 25, 29, 33, 37, 31, 29, 26, 23, 27, 31, 25, 19, 13, 9, 5, 3],
        //     'friday' => [3, 2, 1, 0, 2, 5, 11, 19, 27, 31, 35, 39, 34, 31, 28, 25, 29, 33, 27, 21, 15, 11, 8, 5],
        //     'saturday' => [2, 1, 0, 0, 1, 3, 8, 15, 24, 28, 32, 35, 30, 28, 25, 22, 26, 30, 24, 18, 12, 8, 5, 3],
        //     'sunday' => [5, 4, 3, 2, 1, 2, 4, 8, 12, 16, 20, 22, 20, 18, 16, 14, 12, 10, 8, 7, 6, 5, 4, 4],
        // ];
        // $hourlyVisits = $weekdayData[$this->filter];

        $labels = [];
        $hourlyVisits = [];

        for ($hour = 0; $hour < 24; $hour++) {
            $labels[] = (string) $hour;
            $hourlyVisits[] = $hourlyVisitCounts->get($hour, 0);
        }

        return [
            'datasets' => [
                [
                    'label' => 'Avg Visits per Hour',
                    'data' => $hourlyVisits,
                    'backgroundColor' => 'rgba(34, 197, 94, 0.6)',
                    'borderColor' => 'rgb(34, 197, 94)',
                    'borderWidth' => 1,
                    'borderRadius' => 4,
                    'hoverBackgroundColor' => 'rgba(34, 197, 94, 0.8)',
                ],
            ],
            'labels' => $labels,
        ];
    }

    protected function getType(): string
    {
        return 'bar';
    }

    protected function getOptions(): array
    {
        return [
            'plugins' => [
                'tooltip' => [
                    'enabled' => true,
                    'mode' => 'index',
                    'intersect' => false,
                ],
                'legend' => [
                    'display' => false,
                ],
            ],
            'scales' => [
                'y' => [
                    'beginAtZero' => true,
                    'ticks' => [
                        'stepSize' => 1,
                    ],
                    'grid' => [
                        'display' => true,
                        'drawBorder' => false,
                    ],
                ],
                'x' => [
                    'grid' => [
                        'display' => false,
                    ],
                ],
            ],
            'interaction' => [
                'mode' => 'nearest',
                'axis' => 'x',
                'intersect' => false,
            ],
            'responsive' => true,
            'maintainAspectRatio' => true,
        ];
    }

    protected function getFilters(): ?array
    {
        return [
            'monday' => 'Monday',
            'tuesday' => 'Tuesday',
            'wednesday' => 'Wednesday',
            'thursday' => 'Thursday',
            'friday' => 'Friday',
            'saturday' => 'Saturday',
            'sunday' => 'Sunday',
        ];
    }
}
