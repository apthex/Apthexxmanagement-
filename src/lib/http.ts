import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message = "Request failed",
    public readonly code?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const unauthorized = () => new HttpError(401, "Authentication required", "unauthenticated");
export const notFound = () => new HttpError(404, "Not found", "not_found");
export const badRequest = (message = "Invalid request") => new HttpError(400, message, "invalid_request");
export const tooManyRequests = () => new HttpError(429, "Too many attempts. Try again later.", "rate_limited");
export const conflict = (message = "That record already exists") => new HttpError(409, message, "conflict");

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Please check the highlighted fields.",
        code: "validation_failed",
        fields: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.status === 404 ? "Not found" : error.message, code: error.code },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  // Never return stack traces, database messages, library versions or SQL.
  console.error("[api] unhandled error", error instanceof Error ? error.message : error);
  return NextResponse.json(
    { error: "Something went wrong." },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw badRequest("Send a valid JSON body.");
  }
}

export async function withApi<T>(handler: () => Promise<T>): Promise<T | NextResponse> {
  try {
    return await handler();
  } catch (error) {
    return errorResponse(error);
  }
}

export function noStoreJson(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

export function requestIp(headers: Headers): string {
  // Cloudflare's header only. Do not trust x-forwarded-for behind Cloudflare.
  return headers.get("cf-connecting-ip")?.trim() || headers.get("x-real-ip")?.trim() || "local";
}

export function requestUserAgent(headers: Headers): string {
  return (headers.get("user-agent") ?? "unknown").slice(0, 512);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Invalid record ids are treated exactly like an inaccessible record. */
export function parseUuid(value: string): string {
  if (!UUID_RE.test(value)) throw notFound();
  return value;
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) throw new HttpError(403, "Origin check failed", "csrf");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Origin check failed", "csrf");
  }
  if (originHost !== host) throw new HttpError(403, "Origin check failed", "csrf");
}
