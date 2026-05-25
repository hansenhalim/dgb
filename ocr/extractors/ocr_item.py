from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(eq=False)
class OcrItem:
    text: str
    rec_poly: list[list[float]] = field(default_factory=list)

    def center_x(self) -> float:
        return (self.rec_poly[0][0] + self.rec_poly[1][0]) / 2

    def center_y(self) -> float:
        return (self.rec_poly[0][1] + self.rec_poly[2][1]) / 2

    def left(self) -> float:
        return min(self.rec_poly[0][0], self.rec_poly[3][0])

    def right(self) -> float:
        return max(self.rec_poly[1][0], self.rec_poly[2][0])

    def top(self) -> float:
        return min(self.rec_poly[0][1], self.rec_poly[1][1])

    def bottom(self) -> float:
        return max(self.rec_poly[2][1], self.rec_poly[3][1])

    def height(self) -> float:
        return self.bottom() - self.top()

    def width(self) -> float:
        return self.right() - self.left()

    def with_text(self, text: str) -> OcrItem:
        return OcrItem(text, self.rec_poly)
