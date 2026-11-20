"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { InlineAlert } from "@/components/portal/ui";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFields({});
    try {
      await apiFetch<{ ok: true; message: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (submitError) {
      setError(errorMessage(submitError));
      setFields(fieldErrors(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="apt-frosted-panel w-full rounded-[22px] sm:rounded-[24px] p-8 sm:p-10 xl:p-11 relative z-10 transition-all">
      <p className="mb-2.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.22em] text-red">Account recovery</p>
      <h1 className="font-display text-[36px] sm:text-[40px] font-semibold tracking-[-0.035em] text-ink leading-tight">Reset password</h1>
      <p className="mt-2.5 font-sans text-[15px] sm:text-[15.5px] leading-relaxed text-zinc-600 mb-7">
        We will email a single-use link to your Apthex address. The link expires in 24 hours.
      </p>

      {sent ? (
        <div className="space-y-5">
          <InlineAlert tone="success">
            If that account exists, a reset link has been sent. Check your inbox, then return here and sign in.
          </InlineAlert>
          <p className="font-sans text-[13px] leading-relaxed text-zinc-500">
            The response is intentionally the same whether or not an account exists. You can close this page safely.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="h-[50px] w-full rounded-xl border border-zinc-300 bg-white font-sans text-[14.5px] font-medium text-ink hover:bg-zinc-50 transition shadow-xs"
          >
            Use a different email
          </button>
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 font-sans text-[13.5px] font-medium text-zinc-600 hover:text-ink pt-2"
          >
            <ArrowLeft className="size-4" aria-hidden /> Back to sign in
          </Link>
        </div>
      ) : (
        <>
          {error ? (
            <InlineAlert tone="error" className="mb-6">
              {error}
            </InlineAlert>
          ) : null}
          <form onSubmit={submit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <label htmlFor="email" className="flex items-center gap-1 font-sans text-[14.5px] font-medium text-zinc-800">
                Work email <span className="text-red font-normal" aria-hidden>*</span>
              </label>
              <div className="relative h-[54px] rounded-xl border border-zinc-300/80 bg-white/70 hover:bg-white/90 focus-within:bg-white focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-[#E11D2E]/15 transition-all shadow-xs flex items-center">
                <Mail className="pointer-events-none absolute left-4 size-[19px] text-zinc-400" aria-hidden />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@apthex.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full h-full bg-transparent pl-12 pr-4 font-sans text-[16px] font-normal text-zinc-900 placeholder:text-zinc-400 outline-none rounded-xl"
                  required
                />
              </div>
              {fields.email ? <p className="font-sans text-[12px] text-red pt-0.5">{fields.email}</p> : null}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#111114] via-[#1a1417] to-[#36090e] border border-black/80 font-sans text-[15.5px] font-semibold text-white shadow-md transition-all duration-200 hover:from-black hover:to-[#4a0d14] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  <span>Sending…</span>
                </>
              ) : (
                <span>Email reset link</span>
              )}
            </button>
          </form>

          <Link
            href="/login"
            className="mt-6 flex items-center justify-center gap-2 font-sans text-[13.5px] font-medium text-zinc-600 hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden /> Back to sign in
          </Link>

          <div className="mt-8 border-t border-zinc-200/80 pt-6 font-sans text-[13px] leading-relaxed text-zinc-600">
            Resetting your password does not reset two-factor authentication. If you have also lost your authenticator,
            ask an owner to reset 2FA from Members.
          </div>
        </>
      )}
    </div>
  );
}
