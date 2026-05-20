<?php

namespace App\Filament\Widgets;

use App\Models\Visit;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Facades\DB;

class VisitsChart extends ChartWidget
{
    protected static ?int $sort = 2;

    protected ?string $heading = 'Visits Chart';

    public ?string $filter = '0';

    protected function getData(): array
    {
        $weeksAgo = (int) $this->filter;

        // Calculate the start and end dates for the selected week
        $endDate = now()->subWeeks($weeksAgo);
        $startDate = $endDate->copy()->subDays(6);

        $visitCounts = Visit::query()
            ->whereBetween('checkin_at', [$startDate->startOfDay(), $endDate->endOfDay()])
            ->select(DB::raw("DATE(checkin_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta') as date"), DB::raw('COUNT(*) as count'))
            ->groupBy('date')
            ->orderBy('date')
            ->pluck('count', 'date');

        $labels = [];
        $data = [];

        // Dummy data for demo purposes
        // $dummyData[0] = [12, 19, 8, 15, 23, 17, 21];
        // $dummyData[1] = [11, 19, 13, 16, 8, 14, 6];
        // $dummyData[2] = [15, 22, 10, 18, 25, 20, 24];
        // $dummyData[3] = [21, 15, 19, 9, 16, 7, 13];

        for ($i = 0; $i < 7; $i++) {
            $date = $startDate->copy()->addDays($i);
            $dateKey = $date->format('Y-m-d');
            $labels[] = $date->format('j M');
            $data[] = $visitCounts->get($dateKey, 0);
            // $data[] = $dummyData[$weeksAgo][$i];
        }

        return [
            'datasets' => [
                [
                    'label' => 'Visits',
                    'data' => $data,
                    'borderColor' => 'rgb(59, 130, 246)',
                    'backgroundColor' => 'rgba(59, 130, 246, 0.1)',
                    'fill' => true,
                    'tension' => 0.4,
                    'pointBackgroundColor' => 'rgb(59, 130, 246)',
                    'pointBorderColor' => '#fff',
                    'pointBorderWidth' => 2,
                    'pointRadius' => 4,
                    'pointHoverRadius' => 6,
                ],
            ],
            'labels' => $labels,
        ];
    }

    protected function getType(): string
    {
        return 'line';
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
            '0' => 'This week',
            '1' => 'Last week',
            '2' => '2 weeks ago',
            '3' => '3 weeks ago',
        ];
    }
}
