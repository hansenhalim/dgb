<?php

namespace App\Filament\Resources\Rfids\Pages;

use App\Filament\Resources\Rfids\RfidResource;
use App\Filament\Resources\Rfids\Schemas\RfidForm;
use App\Models\Rfid;
use Filament\Actions\Action;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\Page;
use Filament\Schemas\Schema;

class EnrollRfid extends Page implements HasForms
{
    use InteractsWithForms;

    protected static string $resource = RfidResource::class;

    protected string $view = 'filament.resources.rfids.pages.enroll-rfid';

    public ?array $data = [];

    public ?array $lastEnrolledCard = null;

    public function form(Schema $schema): Schema
    {
        return RfidForm::configure($schema);
    }

    public function previewAction(): Action
    {
        return Action::make('preview')
            ->label('Preview (p)')
            ->color('gray')
            ->action(fn () => $this->dispatch('start-rfid-preview'));
    }

    public function enrollAction(): Action
    {
        return Action::make('enroll')
            ->label('Start Enrollment (e)')
            ->color('primary')
            ->action(fn () => $this->dispatch('start-rfid-enrollment'));
    }

    public function checkUidExists(string $uid): bool
    {
        return Rfid::whereUid($uid)->exists();
    }

    public function handlePreview(string $uid): void
    {
        $uid = strtoupper($uid);

        // Calculate uid_numeric directly without creating a model instance
        $swapped = implode('', array_reverse(str_split($uid, 2)));
        $decimal = hexdec($swapped);
        $uidNumeric = str_pad((string) $decimal, 10, '0', STR_PAD_LEFT);

        // Store the preview info to display on the page
        $this->lastEnrolledCard = [
            'uid' => $uid,
            'uid_numeric' => $uidNumeric,
            'enrolled_at' => now()->timezone('Asia/Jakarta')->format('H:i:s'),
        ];
    }

    public function handleEnrollmentComplete(string $uid): void
    {
        $uid = strtoupper($uid);

        // Create new RFID with just the UID
        $rfid = Rfid::create([
            'uid' => $uid,
            'key' => str_repeat('C0FFEEC0FFEE', 16),
        ]);

        // Refresh to get the actual stored values from database
        $rfid->refresh();

        // Store the enrolled card info to display on the page
        $this->lastEnrolledCard = [
            'uid' => $rfid->uid,
            'uid_numeric' => $rfid->uid_numeric,
            'enrolled_at' => now()->timezone('Asia/Jakarta')->format('H:i:s'),
        ];

        Notification::make()
            ->title('Card Enrolled Successfully')
            ->body("UID: {$uid} has been saved to the database. You can now enroll another card.")
            ->success()
            ->send();
    }
}
