<?php

namespace App\Actions\Extractors;

use App\Enums\IdType;

final class ExtractFields
{
    private const KTP_FIELD_MAP = [
        'NIK' => ['nik'],
        'Nama' => ['nama'],
        'Tempat/Tgl Lahir' => ['tempat_lahir', 'tanggal_lahir'],
        'Jenis kelamin' => ['jenis_kelamin'],
        'Gol. Darah' => ['golongan_darah'],
        'Alamat' => ['alamat'],
        'RT/RW' => ['rt', 'rw'],
        'Kel/Desa' => ['kelurahan'],
        'Kecamatan' => ['kecamatan'],
        'Agama' => ['agama'],
        'Status Perkawinan' => ['status_perkawinan'],
        'Pekerjaan' => ['pekerjaan'],
        'Kewarganegaraan' => ['kewarganegaraan'],
        'Berlaku Hingga' => ['berlaku_hingga'],
    ];

    private const SIM_MODERN_FIELD_MAP = [
        'Nama/Name' => ['nama'],
        'Tempat, Tgl Lahir/Place' => ['tempat_lahir', 'tanggal_lahir'],
        'Gol Darah/Blood type' => ['golongan_darah'],
        'Jenis Kelamin/Sex' => ['jenis_kelamin'],
        'Alamat/Address' => ['alamat'],
        'Pekerjaan/Occupation' => ['pekerjaan'],
        'Diterbitkan Oleh/Issued By' => ['tempat_pembuatan'],
    ];

    private const SIM_SIX_LINE_MAP = [
        '1.' => ['nama'],
        '2.' => ['tempat_lahir', 'tanggal_lahir'],
        '3.' => ['golongan_darah', 'jenis_kelamin'],
        '4.' => ['alamat'],
        '5.' => ['pekerjaan'],
        '6.' => ['tempat_pembuatan'],
    ];

    private const SIM_OLD_FIELD_MAP = [
        'Nama' => ['nama'],
        'Alamat' => ['alamat'],
        'Tempat &' => ['tempat_lahir'],
        'Tgl.Lahir' => ['tanggal_lahir'],
        'Tinggi' => [],
        'Pekerjaan' => ['pekerjaan'],
        'No. SIM' => ['nomor_sim'],
        'Berlaku s/d' => ['tanggal_berlaku'],
    ];

    private const MULTI_LINE_LABELS = [
        'Nama',
        'Tempat/Tgl Lahir',
        'Alamat',
        'Alamat/Address',
        '4.',
    ];

    private const SIM_OLD_MULTI_LINE_LABELS = ['Alamat'];

    /**
     * @param  OcrItem[]  $items
     * @param  array<string, IdType>  $labelDictionary
     * @return array<string, string|null>
     */
    public function execute(array $items, IdType $idType, array $labelDictionary): array
    {
        return match ($idType) {
            IdType::Ktp => $this->extractKtp($items, $labelDictionary),
            IdType::SimModern => $this->extractSimModern($items, $labelDictionary),
            IdType::SimSixLine => $this->extractSimSixLine($items),
            IdType::SimOld => $this->extractSimOld($items),
            IdType::Sim => $this->extractSimModern($items, $labelDictionary),
        };
    }

    /**
     * @param  OcrItem[]  $items
     * @param  array<string, IdType>  $labelDictionary
     * @return array<string, string|null>
     */
    private function extractKtp(array $items, array $labelDictionary): array
    {
        [$provinsi, $kota] = $this->extractKtpHeader($items);

        $filteredItems = $this->excludeStampItems($items);

        $pairs = $this->pairLabelsWithValues($filteredItems, $labelDictionary, IdType::Ktp, self::KTP_FIELD_MAP);
        $fields = [];

        foreach (self::KTP_FIELD_MAP as $label => $fieldKeys) {
            $value = $pairs[$label] ?? null;

            if ($label === 'Tempat/Tgl Lahir') {
                if ($value !== null) {
                    [$tempat, $tanggal] = $this->splitTempatTanggalLahir($value);
                    $fields['tempat_lahir'] = $tempat;
                    $fields['tanggal_lahir'] = $tanggal;
                } else {
                    $fields['tempat_lahir'] = null;
                    $fields['tanggal_lahir'] = null;
                }
            } elseif ($label === 'RT/RW') {
                if ($value !== null) {
                    [$rt, $rw] = $this->splitRtRw($value);
                    $fields['rt'] = $rt;
                    $fields['rw'] = $rw;
                } else {
                    $fields['rt'] = null;
                    $fields['rw'] = null;
                }
            } elseif (count($fieldKeys) === 1) {
                $fields[$fieldKeys[0]] = $value;
            }

            if ($label === 'Kecamatan') {
                $fields['provinsi'] = $provinsi;
                $fields['kota'] = $kota;
            }
        }

        return $fields;
    }

    /**
     * @param  OcrItem[]  $items
     * @return array{string|null, string|null}
     */
    private function extractKtpHeader(array $items): array
    {
        $topItems = collect($items)
            ->sortBy(fn (OcrItem $item) => $item->top())
            ->take(5);

        $provinsi = null;
        $kota = null;

        foreach ($topItems as $item) {
            $upper = strtoupper($item->text);

            if ($provinsi === null && str_contains($upper, 'PROVINSI')) {
                $provinsi = trim(preg_replace('/^PROVINSI\s*/i', '', $upper));
            } elseif ($kota === null && (str_starts_with($upper, 'KOTA') || str_starts_with($upper, 'KABUPATEN'))) {
                $kota = preg_replace('/^(KOTA|KABUPATEN)(?!\s)/', '$1 ', $upper);
            }
        }

        return [$provinsi ?: null, $kota ?: null];
    }

    /**
     * Detect the right-side stamp region on KTP cards. Returns the X threshold
     * beyond which items are likely stamp elements (city name, dates) rather than
     * field values. Uses the largest horizontal gap in item positions.
     *
     * @param  OcrItem[]  $items
     */
    /**
     * Exclude stamp/signature items from the bottom-right corner of KTP cards.
     * These are typically the city name (split across lines) and a date,
     * clustered in the bottom-right while the Gol. Darah field (also right-shifted)
     * sits in the middle rows.
     *
     * @param  OcrItem[]  $items
     * @return OcrItem[]
     */
    private function excludeStampItems(array $items): array
    {
        if (count($items) < 5) {
            return $items;
        }

        $allTops = array_map(fn (OcrItem $i) => $i->top(), $items);
        $bottomThreshold = min($allTops) + (max($allTops) - min($allTops)) * 0.65;

        // Find the main content right edge (median of right positions)
        $rightPositions = array_map(fn (OcrItem $i) => $i->right(), $items);
        sort($rightPositions);
        $medianRight = $rightPositions[(int) (count($rightPositions) * 0.5)];

        return array_values(array_filter(
            $items,
            fn (OcrItem $item) => ! ($item->top() >= $bottomThreshold && $item->left() > $medianRight),
        ));
    }

    /**
     * @param  OcrItem[]  $items
     * @param  array<string, IdType>  $labelDictionary
     * @return array<string, string|null>
     */
    private function extractSimModern(array $items, array $labelDictionary): array
    {
        $pairs = $this->pairLabelsWithBelowValues($items, $labelDictionary, IdType::SimModern, self::SIM_MODERN_FIELD_MAP);
        $fields = [];

        $fields['nomor_sim'] = $this->extractSimNumber($items);

        foreach (self::SIM_MODERN_FIELD_MAP as $label => $fieldKeys) {
            $value = $pairs[$label] ?? null;

            if ($label === 'Tempat, Tgl Lahir/Place' && $value !== null) {
                [$tempat, $tanggal] = $this->splitTempatTanggalLahir($value);
                $fields['tempat_lahir'] = $tempat;
                $fields['tanggal_lahir'] = $tanggal;
            } elseif (count($fieldKeys) === 1) {
                $fields[$fieldKeys[0]] = $value;
            }
        }

        $fields['jenis_sim'] = $this->extractSimType($items);
        $fields['tanggal_berlaku'] = $this->extractDateFromBottom($items);

        return $fields;
    }

    /**
     * @param  OcrItem[]  $items
     * @return array<string, string|null>
     */
    private function extractSimSixLine(array $items): array
    {
        [$pairs, $usedItemIds] = $this->pairNumberedLines($items);
        $pairs = $this->fillMissingSimLines($items, $pairs, $usedItemIds);
        $fields = [];

        $fields['nomor_sim'] = $this->extractSimNumber($items);

        foreach (self::SIM_SIX_LINE_MAP as $label => $fieldKeys) {
            $value = $pairs[$label] ?? null;

            if ($label === '2.') {
                if ($value !== null) {
                    [$tempat, $tanggal] = $this->splitTempatTanggalLahir($value);
                    $fields['tempat_lahir'] = $tempat;
                    $fields['tanggal_lahir'] = $tanggal;
                } else {
                    $fields['tempat_lahir'] = null;
                    $fields['tanggal_lahir'] = null;
                }
            } elseif ($label === '3.') {
                if ($value !== null) {
                    [$golDarah, $jenisKelamin] = $this->splitGolDarahJenisKelamin($value);
                    $fields['golongan_darah'] = $golDarah;
                    $fields['jenis_kelamin'] = $jenisKelamin;
                } else {
                    $fields['golongan_darah'] = null;
                    $fields['jenis_kelamin'] = null;
                }
            } else {
                $fields[$fieldKeys[0]] = $value;
            }
        }

        $fields['jenis_sim'] = $this->extractSimType($items);
        $fields['tanggal_berlaku'] = $this->extractDateFromBottom($items);

        return $fields;
    }

    /**
     * SIM Old layout: left-column labels with right-column values on the same
     * row (like KTP). Address wraps across multiple lines; jenis_kelamin sits
     * in the top-right; tempat_pembuatan appears on the row below the issue
     * date line; jenis_sim is the tall class letter at the top-left.
     *
     * @param  OcrItem[]  $items
     * @return array<string, string|null>
     */
    private function extractSimOld(array $items): array
    {
        $pairs = $this->pairSimOldLabels($items);

        return [
            'nomor_sim' => $pairs['No. SIM'] ?? $this->extractSimNumber($items),
            'nama' => $pairs['Nama'] ?? null,
            'tempat_lahir' => $pairs['Tempat &'] ?? null,
            'tanggal_lahir' => $this->extractDateString($pairs['Tgl.Lahir'] ?? null),
            'golongan_darah' => null,
            'jenis_kelamin' => $this->extractSimOldSex($items),
            'alamat' => $pairs['Alamat'] ?? null,
            'pekerjaan' => $pairs['Pekerjaan'] ?? null,
            'tempat_pembuatan' => $this->extractSimOldTempatPembuatan($items),
            'jenis_sim' => $this->extractSimType($items),
            'tanggal_berlaku' => $this->extractDateString($pairs['Berlaku s/d'] ?? null),
        ];
    }

    /**
     * @param  OcrItem[]  $items
     * @return array<string, string|null>
     */
    private function pairSimOldLabels(array $items): array
    {
        $labelSet = array_keys(self::SIM_OLD_FIELD_MAP);
        $labelItems = [];
        $nonLabelItems = [];

        foreach ($items as $item) {
            if (in_array($item->text, $labelSet, true)) {
                $labelItems[] = $item;
            } else {
                $nonLabelItems[] = $item;
            }
        }

        usort($labelItems, fn (OcrItem $a, OcrItem $b) => $a->centerY() <=> $b->centerY());

        $pairs = [];
        $usedItems = [];

        for ($i = 0; $i < count($labelItems); $i++) {
            $label = $labelItems[$i];
            $nextLabelY = ($i + 1 < count($labelItems)) ? $labelItems[$i + 1]->top() : PHP_FLOAT_MAX;
            $isMultiLine = in_array($label->text, self::SIM_OLD_MULTI_LINE_LABELS, true);

            $rowCandidates = $this->findRowCandidates($label, $nonLabelItems, $usedItems, $labelItems);

            foreach ($rowCandidates as $candidate) {
                $usedItems[spl_object_id($candidate)] = true;
            }

            $value = implode(' ', array_map(fn (OcrItem $c) => $c->text, $rowCandidates));

            if ($isMultiLine) {
                $belowCandidates = $this->findBelowCandidates(
                    $label,
                    $rowCandidates,
                    $nonLabelItems,
                    $nextLabelY,
                    $usedItems,
                );

                foreach ($belowCandidates as $candidate) {
                    $usedItems[spl_object_id($candidate)] = true;
                }

                if (! empty($belowCandidates)) {
                    $belowText = implode(' ', array_map(fn (OcrItem $c) => $c->text, $belowCandidates));
                    $value = trim($value.' '.$belowText);
                }
            }

            $pairs[$label->text] = $value !== '' ? $value : null;
        }

        return $pairs;
    }

    /**
     * @param  OcrItem[]  $items
     */
    private function extractSimOldSex(array $items): ?string
    {
        foreach ($items as $item) {
            $upper = strtoupper(trim($item->text));

            if ($upper === 'PRIA' || $upper === 'WANITA') {
                return $upper;
            }
        }

        return null;
    }

    /**
     * tempat_pembuatan is the row directly below the "CITY, DD-MM-YYYY" issue
     * date row, stopping before the signatory/rank lines.
     *
     * @param  OcrItem[]  $items
     */
    private function extractSimOldTempatPembuatan(array $items): ?string
    {
        $issueRow = null;

        foreach ($items as $item) {
            if (preg_match('/^[A-Z][A-Z\s]+,\s*\d{2}-\d{2}-\d{4}/', trim($item->text))) {
                if ($issueRow === null || $item->top() > $issueRow->top()) {
                    $issueRow = $item;
                }
            }
        }

        if ($issueRow === null) {
            return null;
        }

        $issueCenterY = $issueRow->centerY();
        $below = array_values(array_filter(
            $items,
            fn (OcrItem $i) => $i->centerY() > $issueCenterY + ($issueRow->height() * 0.3),
        ));

        if (empty($below)) {
            return null;
        }

        usort($below, fn (OcrItem $a, OcrItem $b) => $a->top() <=> $b->top());

        $first = $below[0];
        $threshold = max($first->height() * 0.7, 5.0);
        $firstY = $first->centerY();

        $rowItems = array_values(array_filter(
            $below,
            fn (OcrItem $i) => abs($i->centerY() - $firstY) < $threshold,
        ));

        usort($rowItems, fn (OcrItem $a, OcrItem $b) => $a->left() <=> $b->left());

        $text = implode(' ', array_map(fn (OcrItem $i) => $i->text, $rowItems));

        if (preg_match('/\b(NRP|KOMBES|AKBP|KOMISARIS|BRIGADIR|S\.IK)\b/i', $text)) {
            return null;
        }

        return $text !== '' ? $text : null;
    }

    private function extractDateString(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        if (preg_match('/\d{2}-\d{2}-\d{4}/', $value, $matches)) {
            return $matches[0];
        }

        $digits = preg_replace('/\D/', '', $value);

        return $this->parseDate((string) $digits);
    }

    /**
     * @param  OcrItem[]  $items
     * @param  array<string, IdType>  $labelDictionary
     * @param  array<string, string[]>  $fieldMap
     * @return array<string, string|null>
     */
    private function pairLabelsWithValues(
        array $items,
        array $labelDictionary,
        IdType $targetType,
        array $fieldMap,
    ): array {
        $labelItems = [];
        $nonLabelItems = [];

        foreach ($items as $item) {
            if (isset($fieldMap[$item->text]) && isset($labelDictionary[$item->text]) && $labelDictionary[$item->text] === $targetType) {
                $labelItems[] = $item;
            } else {
                $nonLabelItems[] = $item;
            }
        }

        usort($labelItems, fn (OcrItem $a, OcrItem $b) => $a->centerY() <=> $b->centerY());

        $pairs = [];
        $usedItems = [];

        for ($i = 0; $i < count($labelItems); $i++) {
            $label = $labelItems[$i];
            $nextLabelY = ($i + 1 < count($labelItems)) ? $labelItems[$i + 1]->top() : PHP_FLOAT_MAX;
            $isMultiLine = in_array($label->text, self::MULTI_LINE_LABELS, true);

            $rowCandidates = $this->findRowCandidates($label, $nonLabelItems, $usedItems, $labelItems);

            foreach ($rowCandidates as $candidate) {
                $usedItems[spl_object_id($candidate)] = true;
            }

            $value = implode(' ', array_map(fn (OcrItem $c) => $c->text, $rowCandidates));

            if ($isMultiLine) {
                $belowCandidates = $this->findBelowCandidates(
                    $label,
                    $rowCandidates,
                    $nonLabelItems,
                    $nextLabelY,
                    $usedItems,
                );

                foreach ($belowCandidates as $candidate) {
                    $usedItems[spl_object_id($candidate)] = true;
                }

                if (! empty($belowCandidates)) {
                    $belowText = implode(' ', array_map(fn (OcrItem $c) => $c->text, $belowCandidates));
                    $value = trim($value.' '.$belowText);
                }
            }

            $pairs[$label->text] = $value !== '' ? $value : null;
        }

        return $pairs;
    }

    /**
     * SIM Modern layout: labels on one line, values on the line directly below.
     *
     * @param  OcrItem[]  $items
     * @param  array<string, IdType>  $labelDictionary
     * @param  array<string, string[]>  $fieldMap
     * @return array<string, string|null>
     */
    private function pairLabelsWithBelowValues(
        array $items,
        array $labelDictionary,
        IdType $targetType,
        array $fieldMap,
    ): array {
        $labelItems = [];
        $nonLabelItems = [];

        foreach ($items as $item) {
            if (isset($fieldMap[$item->text]) && isset($labelDictionary[$item->text]) && $labelDictionary[$item->text] === $targetType) {
                $labelItems[] = $item;
            } else {
                $nonLabelItems[] = $item;
            }
        }

        usort($labelItems, fn (OcrItem $a, OcrItem $b) => $a->centerY() <=> $b->centerY());

        $pairs = [];
        $usedItems = [];

        for ($i = 0; $i < count($labelItems); $i++) {
            $label = $labelItems[$i];
            $nextLabelY = $this->findNextLabelYBelow($label, $labelItems, $i);
            $isMultiLine = in_array($label->text, self::MULTI_LINE_LABELS, true);

            $belowCandidates = $this->findDirectlyBelowCandidates(
                $label,
                $nonLabelItems,
                $nextLabelY,
                $usedItems,
                $isMultiLine,
            );

            foreach ($belowCandidates as $candidate) {
                $usedItems[spl_object_id($candidate)] = true;
            }

            $value = implode(' ', array_map(fn (OcrItem $c) => $c->text, $belowCandidates));
            $pairs[$label->text] = $value !== '' ? $value : null;
        }

        return $pairs;
    }

    /**
     * Find the next label that is actually on a different row (not same-row neighbor).
     *
     * @param  OcrItem[]  $sortedLabels
     */
    private function findNextLabelYBelow(OcrItem $currentLabel, array $sortedLabels, int $currentIndex): float
    {
        for ($j = $currentIndex + 1; $j < count($sortedLabels); $j++) {
            $candidate = $sortedLabels[$j];
            $isSameRow = abs($candidate->centerY() - $currentLabel->centerY()) < $currentLabel->height() * 0.7;

            if (! $isSameRow) {
                return $candidate->top();
            }
        }

        return PHP_FLOAT_MAX;
    }

    /**
     * Find value items directly below a label (SIM Modern layout).
     *
     * @param  OcrItem[]  $allItems
     * @param  array<int, bool>  $usedItems
     * @return OcrItem[]
     */
    private function findDirectlyBelowCandidates(
        OcrItem $label,
        array $allItems,
        float $nextLabelY,
        array $usedItems,
        bool $isMultiLine,
    ): array {
        $candidates = [];

        foreach ($allItems as $item) {
            if (isset($usedItems[spl_object_id($item)])) {
                continue;
            }

            $isBelowLabel = $item->top() >= $label->bottom() - ($label->height() * 0.5);
            $isAboveNextLabel = $item->centerY() < $nextLabelY;
            $isLeftAligned = abs($item->left() - $label->left()) < ($label->width() * 0.5);

            if ($isBelowLabel && $isAboveNextLabel && $isLeftAligned) {
                $candidates[] = $item;
            }
        }

        usort($candidates, fn (OcrItem $a, OcrItem $b) => $a->top() <=> $b->top());

        if (! $isMultiLine && count($candidates) > 0) {
            // Only take the first line below the label
            $firstY = $candidates[0]->centerY();
            $candidates = array_filter(
                $candidates,
                fn (OcrItem $c) => abs($c->centerY() - $firstY) < $c->height() * 0.7,
            );
        }

        return array_values($candidates);
    }

    /**
     * @param  OcrItem[]  $items
     * @return array{array<string, string|null>, array<int, bool>}
     */
    private function pairNumberedLines(array $items): array
    {
        $numberedLabels = [];
        $nonLabelItems = [];

        foreach ($items as $item) {
            if (preg_match('/^[1-6]\.$/', $item->text)) {
                $numberedLabels[] = $item;
            } else {
                $nonLabelItems[] = $item;
            }
        }

        usort($numberedLabels, fn (OcrItem $a, OcrItem $b) => $a->centerY() <=> $b->centerY());

        $hasLabel5 = collect($numberedLabels)->contains(fn (OcrItem $i) => $i->text === '5.');

        $pairs = [];
        $usedItems = [];

        for ($i = 0; $i < count($numberedLabels); $i++) {
            $label = $numberedLabels[$i];
            $usedItems[spl_object_id($label)] = true;

            $nextLabelY = ($i + 1 < count($numberedLabels)) ? $numberedLabels[$i + 1]->top() : PHP_FLOAT_MAX;
            $isMultiLine = $label->text === '4.';

            $rowCandidates = $this->findRowCandidates($label, $nonLabelItems, $usedItems, $numberedLabels);

            foreach ($rowCandidates as $candidate) {
                $usedItems[spl_object_id($candidate)] = true;
            }

            $value = implode(' ', array_map(fn (OcrItem $c) => $c->text, $rowCandidates));

            if ($isMultiLine) {
                $belowCandidates = $this->findBelowCandidates(
                    $label,
                    $rowCandidates,
                    $nonLabelItems,
                    $nextLabelY,
                    $usedItems,
                );

                // When 5. is absent, reserve the last row for pekerjaan
                if (! $hasLabel5 && count($belowCandidates) > 0) {
                    $belowCandidates = $this->excludeLastRow($belowCandidates);
                }

                foreach ($belowCandidates as $candidate) {
                    $usedItems[spl_object_id($candidate)] = true;
                }

                if (! empty($belowCandidates)) {
                    $belowText = implode(' ', array_map(fn (OcrItem $c) => $c->text, $belowCandidates));
                    $value = trim($value.' '.$belowText);
                }
            }

            $pairs[$label->text] = $value !== '' ? $value : null;
        }

        return [$pairs, $usedItems];
    }

    /**
     * Remove items on the last Y-row from the candidate list.
     *
     * @param  OcrItem[]  $candidates
     * @return OcrItem[]
     */
    private function excludeLastRow(array $candidates): array
    {
        if (empty($candidates)) {
            return [];
        }

        $lastY = end($candidates)->centerY();
        $threshold = end($candidates)->height() * 0.7;

        return array_values(array_filter(
            $candidates,
            fn (OcrItem $c) => abs($c->centerY() - $lastY) > $threshold,
        ));
    }

    /**
     * Fill in missing SIM 6-line pairs using positional and content-based fallback.
     *
     * @param  OcrItem[]  $items
     * @param  array<string, string|null>  $pairs
     * @param  array<int, bool>  $usedItemIds
     * @return array<string, string|null>
     */
    private function fillMissingSimLines(array $items, array $pairs, array $usedItemIds): array
    {
        $missingLines = [];
        for ($n = 1; $n <= 6; $n++) {
            if (! isset($pairs["$n."])) {
                $missingLines[] = $n;
            }
        }

        if (empty($missingLines)) {
            return $pairs;
        }

        $unclaimedItems = $this->collectUnclaimedItems($items, $usedItemIds);

        if (empty($unclaimedItems)) {
            return $pairs;
        }

        usort($unclaimedItems, function (OcrItem $a, OcrItem $b) {
            $yDiff = $a->top() - $b->top();
            if (abs($yDiff) > 5) {
                return $yDiff <=> 0;
            }

            return $a->left() <=> $b->left();
        });

        // Line 1 (name): first content row
        if (in_array(1, $missingLines) && ! empty($unclaimedItems)) {
            $nameItems = $this->takeFirstRow($unclaimedItems);

            if (! empty($nameItems)) {
                $pairs['1.'] = implode(' ', array_map(fn (OcrItem $c) => $c->text, $nameItems));
                $unclaimedItems = $this->removeItems($unclaimedItems, $nameItems);
            }
        }

        // Line 2 (birth info): item containing a date pattern
        if (in_array(2, $missingLines) && ! empty($unclaimedItems)) {
            $birthItem = $this->findItemWithDate($unclaimedItems);

            if ($birthItem !== null) {
                $pairs['2.'] = $birthItem->text;
                $unclaimedItems = $this->removeItems($unclaimedItems, [$birthItem]);
            }
        }

        // Line 3 (blood type / sex): item containing PRIA or WANITA
        if (in_array(3, $missingLines) && ! empty($unclaimedItems)) {
            $sexItem = $this->findItemWithSex($unclaimedItems);

            if ($sexItem !== null) {
                $pairs['3.'] = $sexItem->text;
                $unclaimedItems = $this->removeItems($unclaimedItems, [$sexItem]);
            }
        }

        // Line 6 (issuing office): last content row
        if (in_array(6, $missingLines) && ! empty($unclaimedItems)) {
            $officeItems = $this->takeLastRow($unclaimedItems);

            if (! empty($officeItems)) {
                $pairs['6.'] = implode(' ', array_map(fn (OcrItem $c) => $c->text, $officeItems));
                $unclaimedItems = $this->removeItems($unclaimedItems, $officeItems);
            }
        }

        // Lines 4 and 5 (address and occupation): remaining items
        $miss4 = in_array(4, $missingLines);
        $miss5 = in_array(5, $missingLines);

        if (($miss4 || $miss5) && ! empty($unclaimedItems)) {
            if ($miss4 && $miss5) {
                [$addressItems, $jobItems] = $this->splitAddressAndOccupation($unclaimedItems);

                if (! empty($addressItems)) {
                    $pairs['4.'] = implode(' ', array_map(fn (OcrItem $c) => $c->text, $addressItems));
                }

                if (! empty($jobItems)) {
                    $pairs['5.'] = implode(' ', array_map(fn (OcrItem $c) => $c->text, $jobItems));
                }
            } elseif ($miss4) {
                $value = implode(' ', array_map(fn (OcrItem $c) => $c->text, $unclaimedItems));
                $pairs['4.'] = $value !== '' ? $value : null;
            } elseif ($miss5) {
                $value = implode(' ', array_map(fn (OcrItem $c) => $c->text, $unclaimedItems));
                $pairs['5.'] = $value !== '' ? $value : null;
            }
        }

        return $pairs;
    }

    /**
     * @param  OcrItem[]  $items
     * @param  array<int, bool>  $usedItemIds
     * @return OcrItem[]
     */
    private function collectUnclaimedItems(array $items, array $usedItemIds): array
    {
        $simNumberBottom = 0;

        foreach ($items as $item) {
            $cleaned = preg_replace('/[\s-]/', '', $item->text);

            if (preg_match('/^\d{10,20}$/', $cleaned)) {
                $simNumberBottom = $item->bottom();

                break;
            }
        }

        $unclaimed = [];

        foreach ($items as $item) {
            if (isset($usedItemIds[spl_object_id($item)])) {
                continue;
            }

            $text = trim($item->text);
            $upper = strtoupper($text);

            // Skip numbered labels
            if (preg_match('/^[1-6]\.$/', $text)) {
                continue;
            }

            // Skip SIM number
            $cleaned = preg_replace('/[\s-]/', '', $text);
            if (preg_match('/^\d{10,20}$/', $cleaned)) {
                continue;
            }

            // Skip date strings
            if (preg_match('/^\d{2}-\d{2}-\d{4}$/', $text)) {
                continue;
            }

            // Skip items in the header area (above SIM number)
            if ($simNumberBottom > 0 && $item->bottom() <= $simNumberBottom) {
                continue;
            }

            // Skip known header texts as safety net
            if (in_array($upper, ['INDONESIA', 'SURAT IZIN MENGEMUDI']) || str_contains($upper, 'DRIVING')) {
                continue;
            }

            // Skip single-character artifacts (misread labels, stray SIM type letters)
            if (strlen($text) <= 1) {
                continue;
            }

            $unclaimed[] = $item;
        }

        return $unclaimed;
    }

    /**
     * @param  OcrItem[]  $items
     * @return OcrItem[]
     */
    private function takeFirstRow(array $items): array
    {
        if (empty($items)) {
            return [];
        }

        $firstY = $items[0]->centerY();
        $threshold = $items[0]->height() * 0.7;

        return array_values(array_filter(
            $items,
            fn (OcrItem $i) => abs($i->centerY() - $firstY) < $threshold,
        ));
    }

    /**
     * @param  OcrItem[]  $items
     * @return OcrItem[]
     */
    private function takeLastRow(array $items): array
    {
        if (empty($items)) {
            return [];
        }

        $last = end($items);
        $lastY = $last->centerY();
        $threshold = $last->height() * 0.7;

        return array_values(array_filter(
            $items,
            fn (OcrItem $i) => abs($i->centerY() - $lastY) < $threshold,
        ));
    }

    /**
     * @param  OcrItem[]  $items
     */
    private function findItemWithDate(array $items): ?OcrItem
    {
        foreach ($items as $item) {
            if (preg_match('/\d{2}-\d{2}-\d{4}/', $item->text)) {
                return $item;
            }
        }

        return null;
    }

    /**
     * @param  OcrItem[]  $items
     */
    private function findItemWithSex(array $items): ?OcrItem
    {
        foreach ($items as $item) {
            $upper = strtoupper($item->text);

            if (str_contains($upper, 'PRIA') || str_contains($upper, 'WANITA')) {
                return $item;
            }
        }

        return null;
    }

    /**
     * Split items into address (all rows except last) and occupation (last row).
     *
     * @param  OcrItem[]  $items
     * @return array{OcrItem[], OcrItem[]}
     */
    private function splitAddressAndOccupation(array $items): array
    {
        if (count($items) <= 1) {
            return [$items, []];
        }

        $lastY = end($items)->centerY();
        $threshold = end($items)->height() * 0.7;

        $addressItems = [];
        $jobItems = [];

        foreach ($items as $item) {
            if (abs($item->centerY() - $lastY) < $threshold) {
                $jobItems[] = $item;
            } else {
                $addressItems[] = $item;
            }
        }

        return [$addressItems, $jobItems];
    }

    /**
     * @param  OcrItem[]  $items
     * @param  OcrItem[]  $toRemove
     * @return OcrItem[]
     */
    private function removeItems(array $items, array $toRemove): array
    {
        $removeIds = array_map(fn (OcrItem $i) => spl_object_id($i), $toRemove);

        return array_values(array_filter(
            $items,
            fn (OcrItem $i) => ! in_array(spl_object_id($i), $removeIds),
        ));
    }

    /**
     * @param  OcrItem[]  $allItems
     * @param  array<int, bool>  $usedItems
     * @param  OcrItem[]  $allLabels
     * @return OcrItem[]
     */
    private function findRowCandidates(OcrItem $label, array $allItems, array $usedItems, array $allLabels = []): array
    {
        $tolerance = $label->height() * 0.8;
        $candidates = [];

        foreach ($allItems as $item) {
            if (isset($usedItems[spl_object_id($item)])) {
                continue;
            }

            $isRightOf = $item->left() > ($label->right() - $tolerance);
            $isSameRow = abs($item->centerY() - $label->centerY()) < ($label->height() * 0.7);

            if ($isRightOf && $isSameRow && $this->isClosestLabel($item, $label, $allLabels)) {
                $candidates[] = $item;
            }
        }

        usort($candidates, fn (OcrItem $a, OcrItem $b) => $a->left() <=> $b->left());

        // Remove candidates that are too far from the previous item (large horizontal gap)
        // The first gap (label to value) uses a generous multiplier since KTP has a
        // fixed-column layout where short labels can be far from values. Stamp items
        // are already excluded by detectStampThreshold before this point.
        $filtered = [];
        $lastRight = $label->right();
        $initialGap = null;

        foreach ($candidates as $candidate) {
            $gap = $candidate->left() - $lastRight;

            if ($initialGap === null) {
                $maxGap = $label->height() * 10;
                $initialGap = $gap;
            } else {
                $maxGap = max($initialGap, $label->height() * 2);
            }

            if ($gap > $maxGap) {
                break;
            }

            $filtered[] = $candidate;
            $lastRight = $candidate->right();
        }

        return $filtered;
    }

    /**
     * @param  OcrItem[]  $allLabels
     */
    private function isClosestLabel(OcrItem $candidate, OcrItem $currentLabel, array $allLabels): bool
    {
        if (empty($allLabels)) {
            return true;
        }

        $currentDistance = abs($candidate->centerY() - $currentLabel->centerY());

        foreach ($allLabels as $otherLabel) {
            if (spl_object_id($otherLabel) === spl_object_id($currentLabel)) {
                continue;
            }

            // Only consider labels that are to the left of the candidate
            // (labels to the right can't claim it as a row value)
            if ($otherLabel->left() >= $candidate->left()) {
                continue;
            }

            $otherDistance = abs($candidate->centerY() - $otherLabel->centerY());

            if ($otherDistance < $currentDistance) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  OcrItem[]  $rowCandidates
     * @param  OcrItem[]  $allItems
     * @param  array<int, bool>  $usedItems
     * @return OcrItem[]
     */
    private function findBelowCandidates(
        OcrItem $label,
        array $rowCandidates,
        array $allItems,
        float $nextLabelY,
        array $usedItems,
    ): array {
        $referenceLeft = ! empty($rowCandidates)
            ? min(array_map(fn (OcrItem $c) => $c->left(), $rowCandidates))
            : $label->right();

        $candidates = [];

        foreach ($allItems as $item) {
            if (isset($usedItems[spl_object_id($item)])) {
                continue;
            }

            $isBelowLabel = $item->top() > $label->bottom() - ($label->height() * 0.3);
            $isAboveNextLabel = $item->centerY() < $nextLabelY;
            $isAligned = $item->left() >= ($referenceLeft - $referenceLeft * 0.2);

            if ($isBelowLabel && $isAboveNextLabel && $isAligned) {
                $candidates[] = $item;
            }
        }

        usort($candidates, function (OcrItem $a, OcrItem $b) {
            $yDiff = $a->top() - $b->top();
            if (abs($yDiff) > 5) {
                return $yDiff <=> 0;
            }

            return $a->left() <=> $b->left();
        });

        return $candidates;
    }

    /**
     * @return array{string|null, string|null}
     */
    private function splitTempatTanggalLahir(string $value): array
    {
        // Find where digits start to split place from date
        if (preg_match('/[\d]/', $value, $m, PREG_OFFSET_CAPTURE)) {
            $place = rtrim(substr($value, 0, $m[0][1]), " ,.\t");
            $place = $this->cleanPlaceName($place);
            $rawDate = substr($value, $m[0][1]);

            $date = $this->parseDate(preg_replace('/\D/', '', $rawDate));

            return [$place !== '' ? $place : null, $date];
        }

        return [$value, null];
    }

    private function parseDate(string $digits): ?string
    {
        if (strlen($digits) !== 8) {
            return null;
        }

        return substr($digits, 0, 2).'-'.substr($digits, 2, 2).'-'.substr($digits, 4, 4);
    }

    private function cleanPlaceName(string $place): string
    {
        return preg_replace('/^[^a-zA-Z]+/', '', $place);
    }

    /**
     * @return array{string|null, string|null}
     */
    private function splitRtRw(string $value): array
    {
        if (str_contains($value, '/')) {
            $parts = explode('/', $value, 2);

            return [trim($parts[0]), trim($parts[1])];
        }

        // Handle merged RT/RW without slash: the slash may be misread as a digit
        // RT and RW are always exactly 3 digits (000-999)
        $digitsOnly = preg_replace('/\D/', '', $value);

        if ($digitsOnly !== null && strlen($digitsOnly) >= 6) {
            return [substr($digitsOnly, 0, 3), substr($digitsOnly, -3)];
        }

        // Less than 6 digits: only RT is reliable, RW is missing or garbled
        if ($digitsOnly !== null && strlen($digitsOnly) >= 3) {
            return [substr($digitsOnly, 0, 3), null];
        }

        return [$value, null];
    }

    /**
     * @return array{string|null, string|null}
     */
    private function splitGolDarahJenisKelamin(string $value): array
    {
        $parts = preg_split('/[\s-]+/', $value, 2);

        if ($parts === false || count($parts) < 2) {
            return [$value, null];
        }

        $firstPart = trim($parts[0]);
        $secondPart = trim($parts[1]);

        $bloodTypes = ['A', 'B', 'AB', 'O', '-'];
        if (in_array(strtoupper($firstPart), $bloodTypes, true)) {
            return [strtoupper($firstPart), $secondPart];
        }

        return [$firstPart, $secondPart];
    }

    /**
     * @param  OcrItem[]  $items
     */
    private function extractSimNumber(array $items): ?string
    {
        $topItems = collect($items)
            ->sortBy(fn (OcrItem $item) => $item->top())
            ->take((int) ceil(count($items) * 0.4));

        foreach ($topItems as $item) {
            $cleaned = preg_replace('/[\s-]/', '', $item->text);
            if (preg_match('/^\d{10,20}$/', $cleaned)) {
                return $item->text;
            }
        }

        foreach ($items as $item) {
            if (preg_match('/^\d{4}-\d{4}-\d{6,}$/', $item->text)) {
                return $item->text;
            }
        }

        foreach ($items as $item) {
            $cleaned = preg_replace('/[\s-]/', '', $item->text);
            if (preg_match('/^\d{10,20}$/', $cleaned)) {
                return $item->text;
            }
        }

        return null;
    }

    /**
     * @param  OcrItem[]  $items
     */
    private function extractSimType(array $items): ?string
    {
        $simTypes = ['A', 'B1', 'B2', 'C', 'D'];

        foreach ($items as $item) {
            $text = strtoupper(trim($item->text));
            if (in_array($text, $simTypes, true)) {
                return $text;
            }
        }

        return null;
    }

    /**
     * @param  OcrItem[]  $items
     */
    private function extractDateFromBottom(array $items): ?string
    {
        $sorted = collect($items)
            ->sortByDesc(fn (OcrItem $item) => $item->top())
            ->take(5);

        foreach ($sorted as $item) {
            if (preg_match('/\d{2}-\d{2}-\d{4}/', $item->text, $matches)) {
                return $matches[0];
            }
        }

        return null;
    }
}
