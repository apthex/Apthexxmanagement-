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
    <div className="w-full rounded-2xl border border-white/[0.12] bg-[#0c0e14]/55 backdrop-blur-2xl p-8 sm:p-10 shadow-[0_24px_64px_rgba(0,0,0,0.7),0_0_40px_rgba(225,29,46,0.08),inset_0_1px_0_rgba(255,255,255,0.12)] relative z-10 transition-all duration-300 hover:border-red-500/30">
      {/* Glass Top Edge Highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl pointer-events-none" />

      <p className="mb-1 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-red-500">Account recovery</p>
      <h1 className="font-display text-2xl sm:text-[28px] font-semibold tracking-tight text-white leading-tight">Reset password</h1>
      <p className="mt-1.5 text-xs text-zinc-400 mb-6 leading-relaxed">
        We will email a single-use recovery link to your Apthex work address. The link expires in 24 hours.
      </p>

      {sent ? (
        <div className="space-y-5">
          <InlineAlert tone="success">
            If that account exists, a reset link has been sent. Check your corporate inbox, then return here and sign in.
          </InlineAlert>
          <p className="font-sans text-xs leading-relaxed text-zinc-400">
            The response is intentionally the same whether or not an account exists. You can close this page safely.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="h-11 w-full rounded-xl border border-white/10 bg-[#121520]/60 backdrop-blur-md font-sans text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/[0.08] transition"
          >
            Use a different email
          </button>
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 font-sans text-xs font-medium text-zinc-400 hover:text-white pt-2 transition"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Back to sign in
          </Link>
        </div>
      ) : (
        <>
          {error ? (
            <InlineAlert tone="error" className="mb-6">
              {error}
            </InlineAlert>
          ) : null}
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-medium text-zinc-300">
                Work email <span className="text-red-500 font-normal" aria-hidden>*</span>
              </label>
              <div className="relative h-11 rounded-xl border border-white/10 bg-[#121520]/60 backdrop-blur-md focus-within:border-red-500/50 focus-within:ring-1 focus-within:ring-red-500/30 transition-all flex items-center">
                <Mail className="pointer-events-none absolute left-3.5 size-4 text-zinc-500" aria-hidden />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="name@apthex.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full h-full bg-transparent pl-10 pr-3 text-sm text-white placeholder:text-zinc-500 outline-none rounded-xl"
                  required
                />
              </div>
              {fields.email ? <p className="text-[11px] text-red-400 pt-0.5">{fields.email}</p> : null}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="group relative flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-sm font-semibold text-white shadow-[0_0_24px_rgba(225,29,46,0.35)] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    <span>Sending…</span>
                  </>
                ) : (
                  <span>Email reset link</span>
                )}
              </button>
            </div>
          </form>

          <Link
            href="/login"
            className="mt-6 flex items-center justify-center gap-2 font-sans text-xs font-medium text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Back to sign in
          </Link>

          <div className="mt-6 border-t border-white/[0.08] pt-4 font-sans text-[11px] leading-relaxed text-zinc-500">
            Resetting your password does not reset two-factor authentication. If you have also lost your authenticator, ask an owner to reset 2FA from Members.
          </div>
        </>
      )}
    </div>
  );
}
