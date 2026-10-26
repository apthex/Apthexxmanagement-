"use client";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fields?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 401) {
    if (typeof window !== "undefined") window.location.assign("/login");
    throw new ApiClientError("Authentication required", 401);
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? ((await response.json()) as { error?: string; fields?: Array<{ path: string; message: string }> }) : null;
  if (!response.ok) {
    throw new ApiClientError(payload?.error ?? "Something went wrong.", response.status, payload?.fields);
  }
  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}

export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiClientError) || !error.fields) return {};
  return Object.fromEntries(error.fields.map((field) => [field.path, field.message]));
}

export function downloadUrl(url: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
