<?php

namespace App\Actions\Extractors;

final class CleanExtractedValues
{
    public const VALUE_DICTIONARY = [
        'status_perkawinan' => [
            'BELUM KAWIN',
            'KAWIN',
            'CERAI HIDUP',
            'CERAI MATI',

            'UNMARRIED',
            'MARRIED',
            'DIVORCE',
        ],
        'jenis_kelamin' => [
            'LAKI-LAKI',
            'PEREMPUAN',
            'PRIA',
            'WANITA',

            'MALE',
            'FEMALE',
        ],
        'agama' => [
            'ISLAM',
            'KRISTEN',
            'KATHOLIK',
            'HINDU',
            'BUDDHA',
            'KONGHUCU',

            'CHRISTIAN',
            'CATHOLIC',
            'CONFUSION',
        ],
        'golongan_darah' => [
            'A',
            'B',
            'AB',
            'O',
            '-',
        ],
        'pekerjaan' => [
            'BELUM/TIDAK BEKERJA',
            'PEGAWAI NEGERI SIPIL (PNS)',
            'MENGURUS RUMAH TANGGA',
            'PELAJAR/MAHASISWA',
            'WIRASWASTA',
            'KARYAWAN BUMN',
            'KARYAWAN SWASTA',
            'DOSEN',
            'BURUH HARIAN LEPAS',
            'SOPIR',

            'OTHERS',
        ],
        'kewarganegaraan' => [
            'WNI',

            'CHINA',
        ],
        'berlaku_hingga' => [
            'SEUMUR HIDUP',
        ],
    ];

    /**
     * @param  array<string, string|null>  $fields
     * @return array<string, string|null>
     */
    public function execute(array $fields): array
    {
        foreach ($fields as $key => &$value) {
            if ($value === null || $value === '') {
                if ($key === 'golongan_darah') {
                    $value = '-';
                } else {
                    $value = null;
                }

                continue;
            }

            $value = ltrim($value, "：: \t\n\r\0\x0B");
            $value = strtoupper(trim($value));

            if (preg_match('/^[\.\,\-\s]+$/', $value)) {
                $value = null;

                continue;
            }

            if ($key === 'nik') {
                $value = $this->correctNik($value);
            } elseif ($key === 'kelurahan' || $key === 'kecamatan') {
                $value = preg_replace('/[^A-Z\s]/', '', $value);
                $value = trim($value) ?: null;
            } elseif ($key === 'tempat_lahir') {
                $value = preg_replace('/[^A-Z\s]/', '', $value);
                $value = trim($value) ?: null;
            } elseif ($key === 'golongan_darah') {
                $value = $this->correctGolonganDarah($value);
            } elseif (isset(self::VALUE_DICTIONARY[$key])) {
                $value = $this->correctValue($value, self::VALUE_DICTIONARY[$key]);
            }
        }

        return $fields;
    }

    private function correctNik(string $value): ?string
    {
        // NIK is always exactly 16 digits — replace common OCR letter-to-digit misreads
        $ocrMap = [
            'O' => '0',
            'Q' => '0',
            'D' => '0',
            'I' => '1',
            'L' => '1',
            'T' => '1',
            'Z' => '2',
            'S' => '5',
            'G' => '6',
            'B' => '8',
        ];

        $cleaned = strtr($value, $ocrMap);
        $cleaned = preg_replace('/\D/', '', $cleaned);

        if (strlen($cleaned) === 16) {
            return $cleaned;
        }

        return $value;
    }

    private function correctGolonganDarah(string $value): ?string
    {
        $cleaned = preg_replace('/[^A-Z0-9]/', '', $value);
        $ocrMap = ['0' => 'O', '8' => 'B'];

        if (isset($ocrMap[$cleaned])) {
            $cleaned = $ocrMap[$cleaned];
        }

        $validValues = self::VALUE_DICTIONARY['golongan_darah'];

        if (in_array($cleaned, $validValues, true)) {
            return $cleaned;
        }

        return '-';
    }

    /**
     * @param  string[]  $validValues
     */
    private function correctValue(string $value, array $validValues): string
    {
        if (in_array($value, $validValues, true)) {
            return $value;
        }

        // Try prefix match: value may have trailing junk from OCR bleeding
        foreach ($validValues as $valid) {
            if (str_starts_with($value, $valid) && strlen($value) > strlen($valid)) {
                $charAfter = $value[strlen($valid)] ?? '';

                if ($charAfter === ' ' || $charAfter === ',' || $charAfter === '.') {
                    return $valid;
                }
            }
        }

        $bestMatch = null;
        $bestDistance = PHP_INT_MAX;

        foreach ($validValues as $valid) {
            $distance = levenshtein($value, $valid);

            if ($distance < $bestDistance) {
                $bestDistance = $distance;
                $bestMatch = $valid;
            }
        }

        if ($bestMatch === null) {
            return $value;
        }

        $maxLen = max(strlen($value), strlen($bestMatch));
        $threshold = $maxLen <= 4 ? 0.5 : 0.3;

        if ($maxLen > 0 && ($bestDistance / $maxLen) < $threshold) {
            return $bestMatch;
        }

        return $value;
    }
}
