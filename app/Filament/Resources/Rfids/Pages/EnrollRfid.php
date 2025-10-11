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

    public ?string $enrolledUid = null;

    public ?string $enrolledKey = null;

    public function form(Schema $schema): Schema
    {
        return RfidForm::configure($schema);
    }

    public function enrollAction(): Action
    {
        return Action::make('enroll')
            ->label('Start Enrollment')
            ->color('primary')
            ->action(fn() => $this->dispatch('start-rfid-enrollment'));
    }

    public function setEnrollmentData(string $uid, string $key): void
    {
        $this->enrolledUid = strtoupper($uid);
        $this->enrolledKey = strtoupper($key);

        Notification::make()
            ->title('RFID Card Detected')
            ->body("UID: {$this->enrolledUid}")
            ->success()
            ->send();
    }

    public function create(): void
    {
        if (!$this->enrolledUid || !$this->enrolledKey) {
            Notification::make()
                ->title('No RFID Data')
                ->body('Please enroll an RFID card first.')
                ->danger()
                ->send();

            return;
        }

        $data = $this->form->getState();

        $rfid = Rfid::create([
            'uid' => $this->enrolledUid,
            'key' => $this->enrolledKey,
            'pin' => $data['pin'] ?? null,
            'rfidable_type' => $data['rfidable_type'] ?? null,
            'rfidable_id' => $data['rfidable_id'] ?? null,
        ]);

        Notification::make()
            ->title('RFID Created')
            ->body('RFID card has been successfully enrolled.')
            ->success()
            ->send();

        $this->redirect(RfidResource::getUrl('edit', ['record' => $rfid]));
    }
}
