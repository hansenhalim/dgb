import { env } from "@/config/env";

export type ApiEnvelope<T> = {
  message: string;
  data: T;
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export type RequestOptions = RequestInit & {
  token?: string | null;
};

export async function request<T>(
  path: string,
  init?: RequestOptions,
): Promise<T> {
  if (!env.apiBaseUrl) {
    throw new Error(
      "EXPO_PUBLIC_API_BASE_URL is not set. Configure it in .env or switch EXPO_PUBLIC_API_MODE=mock.",
    );
  }
  const { token, headers, ...rest } = init ?? {};
  const isFormData =
    typeof FormData !== "undefined" && rest.body instanceof FormData;
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    ...rest,
    headers: {
      // Skip default Content-Type for FormData so fetch can set the multipart boundary.
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  });
  const text = await res.text();
  const body: unknown = text ? safeParse(text) : null;
  if (!res.ok) {
    const message =
      (typeof body === "object" && body && "message" in body
        ? String((body as { message: unknown }).message)
        : null) ?? `Request failed: ${res.status}`;
    throw new HttpError(res.status, message, body);
  }
  return body as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
