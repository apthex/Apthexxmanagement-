/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";
const apiTarget = (process.env.API_PROXY_TARGET || "http://localhost:4000").replace(/\/$/, "");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // dev me React/Turbopack ko eval() chahiye — prod me ye directive nahi jati
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Next dev-tools badge (bottom "N" button) off — production builds never show it.
  devIndicators: false,
  async rewrites() {
    // Local development only: proxy /api/* to the local Express server.
    // In production the API routing happens at the edge via vercel.json
    // (function-runtime rewrites cannot resolve *.vercel.app targets —
    // they resolve to a private IP and fail with DNS_HOSTNAME_RESOLVED_PRIVATE).
    if (!isDev) return [];
    return [{ source: "/api/:path*", destination: `${apiTarget}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/desk/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/complaint-review-console",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/complaint-review-console/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default nextConfig;
