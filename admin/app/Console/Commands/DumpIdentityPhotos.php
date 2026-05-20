<?php

namespace App\Console\Commands;

use App\Jobs\DumpIdentityPhotos as DumpIdentityPhotosJob;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('app:dump-identity-photos')]
#[Description('Dump all Visit identity photos to local storage as decrypted JPEGs')]
class DumpIdentityPhotos extends Command
{
    public function handle(): int
    {
        DumpIdentityPhotosJob::dispatchSync();

        $this->info('Identity photos dumped to storage/app/private/identity-photos-dump.');

        return self::SUCCESS;
    }
}
