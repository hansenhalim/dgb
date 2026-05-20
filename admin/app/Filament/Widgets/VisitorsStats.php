<?php

namespace App\Filament\Widgets;

use App\Models\Visit;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Facades\DB;

class VisitorsStats extends StatsOverviewWidget
{
    protected static ?int $sort = 1;

    protected function getHeading(): string
    {
        return 'Visitor Statistics ('.now()->format('F Y').')';
    }

    protected function getStats(): array
    {
        $currentMonthStart = now()->startOfMonth();
        $lastMonthStart = now()->subMonth()->startOfMonth();
        $lastMonthEnd = now()->subMonth()->endOfMonth();

        // Total Visits This Month
        $currentMonthVisits = Visit::query()
            ->whereNotNull('checkin_at')
            ->where('checkin_at', '>=', $currentMonthStart)
            ->count();

        $lastMonthVisits = Visit::query()
            ->whereNotNull('checkin_at')
            ->whereBetween('checkin_at', [$lastMonthStart, $lastMonthEnd])
            ->count();

        $visitsChange = $lastMonthVisits > 0
            ? round((($currentMonthVisits - $lastMonthVisits) / $lastMonthVisits) * 100, 1)
            : 0;

        // Repeat Visitors Percentage
        $totalVisitors = Visit::query()
            ->whereNotNull('checkin_at')
            ->where('checkin_at', '>=', $currentMonthStart)
            ->distinct('visitor_id')
            ->count('visitor_id');

        $repeatVisitors = Visit::query()
            ->whereNotNull('checkin_at')
            ->where('checkin_at', '>=', $currentMonthStart)
            ->select('visitor_id')
            ->groupBy('visitor_id')
            ->havingRaw('COUNT(*) > 1')
            ->get()
            ->count();

        $repeatPercentage = $totalVisitors > 0
            ? round(($repeatVisitors / $totalVisitors) * 100, 1)
            : 0;

        // Average Visit Duration
        $avgDuration = Visit::query()
            ->whereNotNull('checkin_at')
            ->whereNotNull('checkout_at')
            ->where('checkin_at', '>=', $currentMonthStart)
            ->select(DB::raw('AVG(EXTRACT(EPOCH FROM (checkout_at - checkin_at)) / 60) as avg_minutes'))
            ->value('avg_minutes');

        $avgDuration ??= 0;
        $hours = floor($avgDuration / 60);
        $minutes = round($avgDuration % 60);
        $durationFormatted = $hours > 0 ? "{$hours}h {$minutes}m" : "{$minutes}m";

        // Dummy data for demo purposes
        // $currentMonthVisits = 342;
        // $visitsChange = 12.5;
        // $repeatPercentage = 38.2;
        // $repeatVisitors = 48;
        // $totalVisitors = 126;
        // $durationFormatted = '2h 15m';

        return [
            Stat::make('Total Visits', number_format($currentMonthVisits))
                ->description($visitsChange >= 0 ? "{$visitsChange}% increase" : abs($visitsChange).'% decrease')
                ->descriptionIcon($visitsChange >= 0 ? 'heroicon-m-arrow-trending-up' : 'heroicon-m-arrow-trending-down')
                ->color($visitsChange >= 0 ? 'success' : 'danger'),

            Stat::make('Repeat Visitors', "{$repeatPercentage}%")
                ->description("{$repeatVisitors} of {$totalVisitors} visitors")
                ->descriptionIcon('heroicon-m-user-group')
                ->color('info'),

            Stat::make('Average Visit Duration', $durationFormatted)
                ->description('Based on completed visits')
                ->descriptionIcon('heroicon-m-clock')
                ->color('warning'),
        ];
    }
}
