import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";
import { loadSession } from "@/lib/auth/session";
import { requestIp, requestUserAgent } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const isLoggedOut = searchParams.logged_out === "1";

  if (!isLoggedOut) {
    const cookieStore = await cookies();
    const headerStore = await headers();
    const token =
      cookieStore.get("apt_session")?.value ||
      cookieStore.get("__Host-apt_session")?.value ||
      cookieStore.get(SESSION_COOKIE)?.value;

    if (token) {
      const session = await loadSession(token, {
        ip: requestIp(headerStore),
        userAgent: requestUserAgent(headerStore),
      });
      if (session) {
        redirect("/dashboard");
      }
    }
  }

  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
