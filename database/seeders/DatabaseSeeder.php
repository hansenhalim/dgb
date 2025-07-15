<?php

namespace Database\Seeders;

use App\Enum\Role;
use App\Models\RFID;
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
            'role' => Role::Guard,
            'name' => 'SATPAM 1',
            'secret_key' => str_repeat('DEADBEEF', 128),
        ]);

        $rfid = RFID::create([
            'uid' => DB::raw("decode('" . 'DEADBEEF' . "', 'hex')"),
            'key' => DB::raw("decode('" . str_repeat('C0FFEEC0FFEE', 16) . "', 'hex')"),
            'pin' => '123456',
        ]);

        $staff->rfids()->save($rfid);

        $staff = Staff::create([
            'role' => Role::Guard,
            'name' => 'SATPAM 2',
            'secret_key' => str_repeat('FEEDFACE', 128),
        ]);

        $rfid = RFID::create([
            'uid' => DB::raw("decode('" . 'FEEDFACE' . "', 'hex')"),
            'key' => DB::raw("decode('" . str_repeat('C0FFEEC0FFEE', 16) . "', 'hex')"),
            'pin' => '123456',
        ]);

        $staff->rfids()->save($rfid);

        $rfid = RFID::create([
            'uid' => DB::raw("decode('" . 'DEADC0DE' . "', 'hex')"),
            'key' => DB::raw("decode('" . str_repeat('C0FFEEC0FFEE', 16) . "', 'hex')"),
        ]);

        $rfid = RFID::create([
            'uid' => DB::raw("decode('" . 'B16B00B5' . "', 'hex')"),
            'key' => DB::raw("decode('" . str_repeat('C0FFEEC0FFEE', 16) . "', 'hex')"),
        ]);

        $rfid = RFID::create([
            'uid' => DB::raw("decode('" . 'DEADF00D' . "', 'hex')"),
            'key' => DB::raw("decode('" . str_repeat('C0FFEEC0FFEE', 16) . "', 'hex')"),
        ]);
    }
}
