<?php

namespace Database\Seeders;

use App\Enum\Position;
use App\Enum\Role;
use App\Models\Destination;
use App\Models\Gate;
use App\Models\Rfid;
use App\Models\Staff;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $sharedKey = str_repeat('C0FFEEC0FFEE', 16);
        $sharedPin = '123456';

        $staff = Staff::create([
            'role' => Role::GUARD,
            'name' => 'SATPAM 1',
            'secret_key' => hex2bin(str_repeat('DEADBEEF', 128)),
        ]);

        $rfid = Rfid::create([
            'uid' => 'DEADBEEF',
            'key' => $sharedKey,
            'pin' => $sharedPin,
        ]);

        $staff->rfids()->save($rfid);

        $staff = Staff::create([
            'role' => Role::GUARD,
            'name' => 'SATPAM 2',
            'secret_key' => hex2bin(str_repeat('FEEDFACE', 128)),
        ]);

        $rfid = Rfid::create([
            'uid' => 'FEEDFACE',
            'key' => $sharedKey,
            'pin' => $sharedPin,
        ]);

        $staff->rfids()->save($rfid);

        Rfid::create([
            'uid' => 'DEADC0DE',
            'key' => $sharedKey,
        ]);

        Rfid::create([
            'uid' => 'B16B00B5',
            'key' => $sharedKey,
        ]);

        Rfid::create([
            'uid' => 'DEADF00D',
            'key' => $sharedKey,
        ]);

        Gate::create([
            'name' => 'Gerbang 1',
            'current_quota' => 300,
            'proximity_id' => '019813a4-cbd1-7add-a4b8-dc56fb1006b9'
        ]);

        Gate::create([
            'name' => 'Gerbang 2',
            'current_quota' => 150,
            'proximity_id' => '019813a4-cbd1-7522-abbc-6962dc04621a'
        ]);

        Gate::create([
            'name' => 'Gerbang 3',
            'current_quota' => 100,
            'proximity_id' => '019813a4-cbd1-7c36-bebe-c7e61a1838ae'
        ]);

        Gate::create([
            'name' => 'Gerbang 4',
            'current_quota' => 0,
            'proximity_id' => '019813a4-cbd1-7935-b20a-ad4c94578a82'
        ]);

        Destination::create([
            'name' => 'AA-1',
            'position' => Position::VILLA1,
        ]);

        Destination::create([
            'name' => 'AA-2',
            'position' => Position::VILLA2,
        ]);

        Destination::create([
            'name' => 'AA-3',
            'position' => Position::EXCLUSIVE,
        ]);
    }
}
