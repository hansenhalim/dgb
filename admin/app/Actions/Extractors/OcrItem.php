<?php

namespace App\Actions\Extractors;

final readonly class OcrItem
{
    /**
     * @param  array<int, array<int, int>>  $recPoly
     */
    public function __construct(
        public string $text,
        public array $recPoly,
    ) {}

    public function centerX(): float
    {
        return ($this->recPoly[0][0] + $this->recPoly[1][0]) / 2;
    }

    public function centerY(): float
    {
        return ($this->recPoly[0][1] + $this->recPoly[2][1]) / 2;
    }

    public function left(): float
    {
        return min($this->recPoly[0][0], $this->recPoly[3][0]);
    }

    public function right(): float
    {
        return max($this->recPoly[1][0], $this->recPoly[2][0]);
    }

    public function top(): float
    {
        return min($this->recPoly[0][1], $this->recPoly[1][1]);
    }

    public function bottom(): float
    {
        return max($this->recPoly[2][1], $this->recPoly[3][1]);
    }

    public function height(): float
    {
        return $this->bottom() - $this->top();
    }

    public function width(): float
    {
        return $this->right() - $this->left();
    }

    public function withText(string $text): self
    {
        return new self($text, $this->recPoly);
    }
}
