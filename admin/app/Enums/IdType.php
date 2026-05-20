<?php

namespace App\Enums;

enum IdType: string
{
    case Ktp = 'KTP';
    case Sim = 'SIM';
    case SimModern = 'SIM_MODERN';
    case SimSixLine = 'SIM_6_LINE';
    case SimOld = 'SIM_OLD';

    /**
     * @return string[]
     */
    public function fields(): array
    {
        return match ($this) {
            self::Ktp => [
                'nik',
                'nama',
                'tempat_lahir',
                'tanggal_lahir',
                'jenis_kelamin',
                'golongan_darah',
                'alamat',
                'rt',
                'rw',
                'kelurahan',
                'kecamatan',
                'agama',
                'status_perkawinan',
                'pekerjaan',
                'kewarganegaraan',
                'berlaku_hingga',
                'provinsi',
                'kota',
            ],
            self::Sim, self::SimModern, self::SimSixLine, self::SimOld => [
                'nomor_sim',
                'nama',
                'tempat_lahir',
                'tanggal_lahir',
                'golongan_darah',
                'jenis_kelamin',
                'alamat',
                'pekerjaan',
                'tempat_pembuatan',
                'jenis_sim',
                'tanggal_berlaku',
            ],
        };
    }
}
