<?php

namespace App\Actions\Extractors;

use App\Enums\IdType;

final class DetermineIdType
{
    /**
     * @param  OcrItem[]  $items
     * @param  array<string, IdType>  $labelDictionary
     */
    public function execute(array $items, array $labelDictionary): IdType
    {
        /** @var array<string, int> $votes */
        $votes = [];
        $labels = array_keys($labelDictionary);

        foreach ($items as $item) {
            $matchedLabel = $this->matchLabel($item->text, $labels);

            if ($matchedLabel !== null) {
                $type = $labelDictionary[$matchedLabel]->value;
                $votes[$type] = ($votes[$type] ?? 0) + 1;
            }
        }

        if (isset($votes[IdType::SimModern->value]) || isset($votes[IdType::SimSixLine->value]) || isset($votes[IdType::SimOld->value])) {
            unset($votes[IdType::Sim->value]);
        }

        if (empty($votes)) {
            return IdType::Ktp;
        }

        arsort($votes);

        return IdType::from(array_key_first($votes));
    }

    /**
     * @param  string[]  $labels
     */
    private function matchLabel(string $text, array $labels): ?string
    {
        $text = trim($text);

        if ($text === '') {
            return null;
        }

        // Exact match (fast path)
        if (in_array($text, $labels, true)) {
            return $text;
        }

        // Fuzzy match via Levenshtein
        $fuzzyMatch = $this->fuzzyMatch($text, $labels);

        if ($fuzzyMatch !== null) {
            return $fuzzyMatch;
        }

        // Prefix detection for merged label+value strings (e.g. "Gol.DarahB", "Kewarganegaraan:WNI")
        return $this->prefixMatch($text, $labels);
    }

    /**
     * @param  string[]  $labels
     */
    private function fuzzyMatch(string $text, array $labels): ?string
    {
        $bestLabel = null;
        $bestDistance = PHP_INT_MAX;
        $textLower = mb_strtolower($text);

        foreach ($labels as $label) {
            $distance = levenshtein($textLower, mb_strtolower($label));

            if ($distance < $bestDistance) {
                $bestDistance = $distance;
                $bestLabel = $label;
            }
        }

        if ($bestLabel === null) {
            return null;
        }

        $maxLen = max(strlen($text), strlen($bestLabel));

        if ($maxLen <= 3) {
            return $bestDistance <= 1 ? $bestLabel : null;
        }

        return $maxLen > 0 && ($bestDistance / $maxLen) < 0.3 ? $bestLabel : null;
    }

    /**
     * @param  string[]  $labels
     */
    private function prefixMatch(string $text, array $labels): ?string
    {
        $bestLabel = null;
        $bestLen = 0;

        foreach ($labels as $label) {
            if (strlen($label) <= 3 || strlen($label) >= strlen($text)) {
                continue;
            }

            $prefix = substr($text, 0, strlen($label));
            $distance = levenshtein(mb_strtolower($prefix), mb_strtolower($label));
            $maxLen = max(strlen($prefix), strlen($label));

            if ($maxLen > 0 && ($distance / $maxLen) < 0.3 && strlen($label) > $bestLen) {
                $bestLabel = $label;
                $bestLen = strlen($label);
            }
        }

        return $bestLabel;
    }
}
