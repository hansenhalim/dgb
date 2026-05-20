import type { ExtractedId, IdExtractor } from "@/domain/ports";

import { delay } from "./latency";

export class MockIdExtractor implements IdExtractor {
  async extract(_imageUri: string): Promise<ExtractedId> {
    await delay(1500);
    return {
      type: "ktp",
      nik: "1871121406670002",
      nama: "JOHN DOE",
    };
  }
}
