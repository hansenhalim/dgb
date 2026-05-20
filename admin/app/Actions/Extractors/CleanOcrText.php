<?php

namespace App\Actions\Extractors;

use App\Enums\IdType;

final class CleanOcrText
{
    /**
     * @param  OcrItem[]  $items
     * @param  array<string, IdType>  $labelDictionary
     * @return OcrItem[]
     */
    public function execute(array $items, array $labelDictionary): array
    {
        $labels = array_keys($labelDictionary);
        $result = [];

        foreach ($items as $item) {
            $numberedSplit = $this->trySplitNumberedPrefix($item);

            if ($numberedSplit !== null) {
                foreach ($numberedSplit as $splitItem) {
                    $result[] = $this->autocorrectLabel($splitItem, $labels);
                }

                continue;
            }

            $splitItems = $this->trySplitMergedString($item, $labels);

            foreach ($splitItems as $splitItem) {
                $result[] = $this->autocorrectLabel($splitItem, $labels);
            }
        }

        return $result;
    }

    /**
     * Split items with numbered SIM prefixes (e.g. "1. MELYANA", "2.B LAMPUNG", ".CHANDRA").
     *
     * @return OcrItem[]|null
     */
    private function trySplitNumberedPrefix(OcrItem $item): ?array
    {
        $text = $item->text;

        // Match "N.VALUE" or "N. VALUE" where N is 1-6
        if (preg_match('/^([1-6]\.\s*)(.+)$/s', $text, $matches)) {
            $leftPart = $matches[1];
            $value = trim($matches[2]);
            $label = substr($leftPart, 0, 2);

            if ($value !== '') {
                return $this->buildSplitItems($item, $label, $leftPart, $value);
            }
        }

        // Match ".VALUE" — leading dot is likely a remnant of "1."
        if (preg_match('/^(\.\s*)([A-Z].+)$/', $text, $matches)) {
            $leftPart = $matches[1];
            $value = trim($matches[2]);

            if ($value !== '') {
                return $this->buildSplitItems($item, '1.', $leftPart, $value);
            }
        }

        return null;
    }

    /**
     * @param  string[]  $labels
     * @return OcrItem[]
     */
    private function trySplitMergedString(OcrItem $item, array $labels): array
    {
        // Try colon separators first: "Status Perkawinan: BELUM KAWIN"
        $separators = ['： ', '：', ': ', ':'];

        foreach ($separators as $separator) {
            $pos = strpos($item->text, $separator);

            if ($pos === false || $pos < 2) {
                continue;
            }

            $leftPart = substr($item->text, 0, $pos);
            $rightPart = trim(substr($item->text, $pos + strlen($separator)));

            if ($rightPart === '') {
                continue;
            }

            $matchedLabel = $this->findBestLabelMatch($leftPart, $labels);

            if ($matchedLabel === null) {
                continue;
            }

            return $this->buildSplitItems($item, $matchedLabel, $leftPart, $rightPart);
        }

        // Try space-separated label+value: "Kewarganegaraan WNI", "Status Perkawinan KAWiN"
        $spaceSplit = $this->trySplitOnLabelPrefix($item, $labels);
        if ($spaceSplit !== null) {
            return $spaceSplit;
        }

        // Try label with trailing value (no separator): "Gol.DarahB" → "Gol. Darah" + "B"
        $trailingSplit = $this->trySplitByTrailingValue($item, $labels);
        if ($trailingSplit !== null) {
            return $trailingSplit;
        }

        return [$item];
    }

    /**
     * @param  string[]  $labels
     * @return OcrItem[]|null
     */
    private function trySplitOnLabelPrefix(OcrItem $item, array $labels): ?array
    {
        $bestMatch = null;
        $bestMatchLen = 0;

        foreach ($labels as $label) {
            if (strlen($label) <= 3 || strlen($label) >= strlen($item->text)) {
                continue;
            }

            $prefix = substr($item->text, 0, strlen($label));
            $charAfter = $item->text[strlen($label)] ?? '';

            if ($charAfter !== ' ') {
                continue;
            }

            $distance = levenshtein(mb_strtolower($prefix), mb_strtolower($label));
            $maxLen = max(strlen($prefix), strlen($label));
            $isMatch = $maxLen > 0 && ($distance / $maxLen) < 0.3;

            if ($isMatch && strlen($label) > $bestMatchLen) {
                $bestMatch = $label;
                $bestMatchLen = strlen($label);
            }
        }

        if ($bestMatch === null) {
            return null;
        }

        $rightPart = trim(substr($item->text, $bestMatchLen));

        if ($rightPart === '') {
            return null;
        }

        return $this->buildSplitItems($item, $bestMatch, substr($item->text, 0, $bestMatchLen), $rightPart);
    }

    /**
     * Detect label merged with a short trailing value without any separator.
     * e.g. "Gol.DarahB" → "Gol. Darah" + "B", "Gol.Darah:O" would already
     * be handled by the colon strategy, but "Gol.DarahO" (no colon) would not.
     *
     * @param  string[]  $labels
     * @return OcrItem[]|null
     */
    private function trySplitByTrailingValue(OcrItem $item, array $labels): ?array
    {
        $text = $item->text;
        $textLen = strlen($text);

        if ($textLen < 5) {
            return null;
        }

        // Don't split items that are already a known label
        if ($this->findBestLabelMatch($text, $labels) !== null) {
            return null;
        }

        for ($trim = 1; $trim <= min(3, $textLen - 4); $trim++) {
            $prefix = substr($text, 0, $textLen - $trim);
            $suffix = substr($text, $textLen - $trim);

            $matchedLabel = $this->findBestLabelMatch($prefix, $labels);

            if ($matchedLabel !== null && strlen($matchedLabel) > 3) {
                return $this->buildSplitItems($item, $matchedLabel, $prefix, $suffix);
            }
        }

        return null;
    }

    /**
     * @return OcrItem[]
     */
    private function buildSplitItems(OcrItem $item, string $matchedLabel, string $leftPart, string $rightPart): array
    {
        $totalLen = strlen($item->text);
        $splitRatio = strlen($leftPart) / max($totalLen, 1);

        $leftPoly = $this->splitPolyLeft($item->recPoly, $splitRatio);
        $rightPoly = $this->splitPolyRight($item->recPoly, $splitRatio);

        return [
            new OcrItem($matchedLabel, $leftPoly),
            new OcrItem($rightPart, $rightPoly),
        ];
    }

    /**
     * @param  string[]  $labels
     */
    private function autocorrectLabel(OcrItem $item, array $labels): OcrItem
    {
        $matchedLabel = $this->findBestLabelMatch($item->text, $labels);

        if ($matchedLabel !== null) {
            return $item->withText($matchedLabel);
        }

        return $item;
    }

    /**
     * @param  string[]  $labels
     */
    private function findBestLabelMatch(string $text, array $labels): ?string
    {
        $text = trim($text);

        if ($text === '') {
            return null;
        }

        if (in_array($text, $labels, true)) {
            return $text;
        }

        $bestLabel = null;
        $bestDistance = PHP_INT_MAX;
        $textLower = mb_strtolower($text);

        foreach ($labels as $label) {
            $labelLower = mb_strtolower($label);
            $distance = levenshtein($textLower, $labelLower);

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

        $threshold = 0.3;

        if ($maxLen > 0 && ($bestDistance / $maxLen) < $threshold) {
            return $bestLabel;
        }

        return null;
    }

    /**
     * @param  array<int, array<int, int>>  $poly
     * @return array<int, array<int, int>>
     */
    private function splitPolyLeft(array $poly, float $ratio): array
    {
        $leftX = $poly[0][0];
        $rightX = $poly[1][0];
        $splitX = (int) ($leftX + ($rightX - $leftX) * $ratio);

        return [
            [$poly[0][0], $poly[0][1]],
            [$splitX, $poly[1][1]],
            [$splitX, $poly[2][1]],
            [$poly[3][0], $poly[3][1]],
        ];
    }

    /**
     * @param  array<int, array<int, int>>  $poly
     * @return array<int, array<int, int>>
     */
    private function splitPolyRight(array $poly, float $ratio): array
    {
        $leftX = $poly[0][0];
        $rightX = $poly[1][0];
        $splitX = (int) ($leftX + ($rightX - $leftX) * $ratio);

        return [
            [$splitX, $poly[0][1]],
            [$poly[1][0], $poly[1][1]],
            [$poly[2][0], $poly[2][1]],
            [$splitX, $poly[3][1]],
        ];
    }
}
