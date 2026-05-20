<?php

namespace App\Jobs;

use App\Models\Visit;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DumpIdentityPhotos implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        $directory = 'dump';
        Storage::disk('local')->makeDirectory($directory);

        $index = 1;

        Visit::whereNotNull('identity_photo')
            ->chunkById(100, function ($visits) use (&$index, $directory) {
                foreach ($visits as $visit) {
                    try {
                        $encryptedData = stream_get_contents($visit->identity_photo);
                        $decrypted = Crypt::decrypt($encryptedData);

                        Storage::disk('local')->put(
                            "{$directory}/image_{$index}.jpg",
                            $decrypted,
                        );

                        $index++;
                    } catch (\Exception $e) {
                        Log::warning('Failed to decrypt identity photo, skipping', [
                            'visit_id' => $visit->id,
                            'error_message' => $e->getMessage(),
                        ]);
                    }
                }
            });
    }
}
