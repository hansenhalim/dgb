import { env } from "@/config/env";
import type { ExtractedId, IdExtractor } from "@/domain/ports";

type ExtractIdResponse = {
  message: string;
  data?: {
    type: string;
    data: {
      nik?: string;
      nomor_sim?: string;
      nama?: string;
    };
  };
};

export class ApiIdExtractor implements IdExtractor {
  async extract(imageUri: string): Promise<ExtractedId> {
    if (!env.apiBaseUrl) {
      throw new Error("EXPO_PUBLIC_API_BASE_URL is not set.");
    }
    const form = new FormData();
    form.append("image", {
      uri: imageUri,
      name: "id.jpg",
      type: "image/jpeg",
    } as unknown as Blob);
    form.append("fields", "nik,nomor_sim,nama");

    const res = await fetch(`${env.apiBaseUrl}/api/extract-id`, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`extract-id failed: ${res.status}`);
    }
    const json: ExtractIdResponse = await res.json();
    const inner = json.data?.data ?? {};
    return {
      type: json.data?.type ?? "unknown",
      nik: inner.nik,
      nomorSim: inner.nomor_sim,
      nama: inner.nama,
    };
  }
}
