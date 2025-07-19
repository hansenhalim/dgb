<?php

namespace Database\Seeders;

use App\Enum\Role;
use App\Models\Gate;
use App\Models\Rfid;
use App\Models\Staff;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $staff = Staff::create([
            'role' => Role::GUARD,
            'name' => 'SATPAM 1',
            'secret_key' => str_repeat('DEADBEEF', 128),
        ]);

        $rfid = Rfid::create([
            'uid' => DB::raw("decode('" . 'DEADBEEF' . "', 'hex')"),
            'key' => DB::raw("decode('" . str_repeat('C0FFEEC0FFEE', 16) . "', 'hex')"),
            'pin' => '123456',
        ]);

        $staff->rfids()->save($rfid);

        $staff = Staff::create([
            'role' => Role::GUARD,
            'name' => 'SATPAM 2',
            'secret_key' => str_repeat('FEEDFACE', 128),
        ]);

        $rfid = Rfid::create([
            'uid' => DB::raw("decode('" . 'FEEDFACE' . "', 'hex')"),
            'key' => DB::raw("decode('" . str_repeat('C0FFEEC0FFEE', 16) . "', 'hex')"),
            'pin' => '123456',
        ]);

        $staff->rfids()->save($rfid);

        Rfid::create([
            'uid' => DB::raw("decode('" . 'DEADC0DE' . "', 'hex')"),
            'key' => DB::raw("decode('" . str_repeat('C0FFEEC0FFEE', 16) . "', 'hex')"),
        ]);

        Rfid::create([
            'uid' => DB::raw("decode('" . 'B16B00B5' . "', 'hex')"),
            'key' => DB::raw("decode('" . str_repeat('C0FFEEC0FFEE', 16) . "', 'hex')"),
        ]);

        Rfid::create([
            'uid' => DB::raw("decode('" . 'DEADF00D' . "', 'hex')"),
            'key' => DB::raw("decode('" . str_repeat('C0FFEEC0FFEE', 16) . "', 'hex')"),
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
    }
}
