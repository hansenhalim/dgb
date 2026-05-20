<?php

namespace App\Actions\Extractors;

use App\Enums\IdType;

final class LabelDictionary
{
    /** @var array<string, IdType> */
    public const LABELS = [
        'NIK' => IdType::Ktp,
        'Nama' => IdType::Ktp,
        'Tempat/Tgl Lahir' => IdType::Ktp,
        'Jenis kelamin' => IdType::Ktp,
        'Alamat' => IdType::Ktp,
        'RT/RW' => IdType::Ktp,
        'Kel/Desa' => IdType::Ktp,
        'Kecamatan' => IdType::Ktp,
        'Agama' => IdType::Ktp,
        'Status Perkawinan' => IdType::Ktp,
        'Pekerjaan' => IdType::Ktp,
        'Kewarganegaraan' => IdType::Ktp,
        'Berlaku Hingga' => IdType::Ktp,
        'Gol. Darah' => IdType::Ktp,

        'Diterbitkan Oleh/Issued By' => IdType::SimModern,
        'Nama/Name' => IdType::SimModern,
        'Tempat, Tgl Lahir/Place' => IdType::SimModern,
        'Gol Darah/Blood type' => IdType::SimModern,
        'Jenis Kelamin/Sex' => IdType::SimModern,
        'Alamat/Address' => IdType::SimModern,
        'Pekerjaan/Occupation' => IdType::SimModern,

        '1.' => IdType::SimSixLine,
        '2.' => IdType::SimSixLine,
        '3.' => IdType::SimSixLine,
        '4.' => IdType::SimSixLine,
        '5.' => IdType::SimSixLine,
        '6.' => IdType::SimSixLine,

        'Tempat &' => IdType::SimOld,
        'Tgl.Lahir' => IdType::SimOld,
        'Tinggi' => IdType::SimOld,
        'No. SIM' => IdType::SimOld,
        'Berlaku s/d' => IdType::SimOld,

        'SURAT IZIN MENGEMUDI' => IdType::Sim,
        'DRIVING LICENSE' => IdType::Sim,
        'INDONESIA' => IdType::Sim,
    ];
}
