import { type NextRequest } from "next/server";
import { login } from "@/lib/auth/service";
import { loginSchema } from "@/lib/validation";
import { assertSameOrigin, noStoreJson, requestIp, requestUserAgent, withApi } from "@/lib/http";
import { landingPath } from "@/lib/permissions";
import { SESSION_COOKIE } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApi(async () => {
    assertSameOrigin(request);
    const body = loginSchema.parse(await request.json());
    const context = { ip: requestIp(request.headers), userAgent: requestUserAgent(request.headers) };
    const result = await login(body.email, body.password, body.code, context);
    const response = noStoreJson({
      ok: true,
      redirect: landingPath(result.accessLevel),
      name: result.name,
    });
    response.cookies.set(SESSION_COOKIE, result.token, result.cookieOptions);
    return response;
  });
}
