import { NextResponse, type NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const ACCESS_HEADER = "Cf-Access-Jwt-Assertion";

function normaliseTeamDomain(raw: string): string {
  const trimmed = raw.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return trimmed.endsWith(".cloudflareaccess.com") ? trimmed : `${trimmed}.cloudflareaccess.com`;
}

function securityHeaders(nonce: string, isDev: boolean): Record<string, string> {
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const connectSrc = isDev ? "'self' ws: wss:" : "'self'";
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src ${connectSrc}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      ...(isDev ? [] : ["upgrade-insecure-requests"]),
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    ...(isDev ? {} : { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" }),
  };
}

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksTeam = "";

async function verifyCloudflareAccess(request: NextRequest): Promise<{ ok: true; payload: JWTPayload } | { ok: false }> {
  const team = process.env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const audience = process.env.CF_ACCESS_AUD?.trim();
  if (!team || !audience) return { ok: false };

  const token = request.headers.get(ACCESS_HEADER);
  if (!token) return { ok: false };

  const teamDomain = normaliseTeamDomain(team);
  const issuer = `https://${teamDomain}`;
  try {
    if (!jwksCache || jwksTeam !== teamDomain) {
      jwksCache = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`), {
        cacheMaxAge: 10 * 60 * 1000,
      });
      jwksTeam = teamDomain;
    }
    const { payload } = await jwtVerify(token, jwksCache, {
      issuer,
      audience,
      algorithms: ["RS256"],
    });
    // exp is mandatory for Access tokens; jose validates it when present, but
    // an absent exp must not be accepted.
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return { ok: false };
    return { ok: true, payload };
  } catch {
    return { ok: false };
  }
}

function isMutation(request: NextRequest): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(request.method);
}

function sameOrigin(request: NextRequest): boolean {
  if (request.nextUrl.pathname.startsWith("/api/cron/")) return true; // bearer secret protected
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";

  if (isMutation(request) && request.nextUrl.pathname.startsWith("/api/") && !sameOrigin(request)) {
    return NextResponse.json({ error: "Origin check failed" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  const csp = securityHeaders(nonce, isDev)["Content-Security-Policy"];
  headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers } });
  for (const [key, value] of Object.entries(securityHeaders(nonce, isDev))) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Cloudflare Access is enforced for every page and API route.
     * Static assets are excluded from middleware to avoid overhead; they
     * contain no private data. Direct Vercel preview deployments are blocked
     * at the platform layer by Deployment Protection.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
