"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Lock, Mail } from "lucide-react";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { InlineAlert } from "@/components/portal/ui";

type LoginResponse = { ok: true; redirect: string; name: string };

export function LoginForm() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFields({});
    try {
      const result = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, code }),
      });
      window.location.assign(result.redirect);
    } catch (loginError) {
      setError(errorMessage(loginError));
      setFields(fieldErrors(loginError));
      setLoading(false);
    }
  }

  return (
    <div className="apt-frosted-panel w-full rounded-[22px] sm:rounded-[24px] p-8 sm:p-10 xl:p-11 relative z-10 transition-all">
      {/* Technical Label (IBM Plex Mono 500, 11.5px) */}
      <p className="mb-2.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.22em] text-red">
        Internal access
      </p>

      {/* Sign-in Heading (Space Grotesk 600, 38px to 42px) */}
      <h1 className="font-display text-[38px] sm:text-[42px] font-semibold tracking-[-0.035em] text-ink leading-tight">
        Sign in
      </h1>

      {/* Supporting Text (Inter 400, 15px to 15.5px) */}
      <p className="mt-2.5 font-sans text-[15px] sm:text-[15.5px] font-normal leading-relaxed text-zinc-600 mb-7">
        Use the Apthex account created for you. Password, then your authenticator code.
      </p>

      {/* Error alert if any */}
      {error ? (
        <InlineAlert tone="error" className="mb-6">
          {error}
        </InlineAlert>
      ) : null}

      <form onSubmit={submit} className="space-y-5" noValidate>
        {/* Work Email Field */}
        <div className="space-y-2">
          {/* Form Label (Inter 500, 14.5px) */}
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

        {/* Password Field */}
        <div className="space-y-2">
          {/* Form Label (Inter 500, 14.5px) */}
          <label htmlFor="password" className="flex items-center gap-1 font-sans text-[14.5px] font-medium text-zinc-800">
            Password <span className="text-red font-normal" aria-hidden>*</span>
          </label>
          <div className="relative h-[54px] rounded-xl border border-zinc-300/80 bg-white/70 hover:bg-white/90 focus-within:bg-white focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-[#E11D2E]/15 transition-all shadow-xs flex items-center">
            <Lock className="pointer-events-none absolute left-4 size-[19px] text-zinc-400" aria-hidden />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full h-full bg-transparent pl-12 pr-12 font-sans text-[16px] font-normal text-zinc-900 placeholder:text-zinc-400 outline-none rounded-xl"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 flex size-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-200/50 hover:text-zinc-700"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4.5" aria-hidden /> : <Eye className="size-4.5" aria-hidden />}
            </button>
          </div>
          {fields.password ? <p className="font-sans text-[12px] text-red pt-0.5">{fields.password}</p> : null}
        </div>

        {/* Authenticator or Recovery Code Field */}
        <div className="space-y-2">
          {/* Form Label (Inter 500, 14.5px) */}
          <label htmlFor="code" className="flex items-center gap-1 font-sans text-[14.5px] font-medium text-zinc-800">
            Authenticator or recovery code <span className="text-red font-normal" aria-hidden>*</span>
          </label>
          <div className="relative h-[54px] rounded-xl border border-zinc-300/80 bg-white/70 hover:bg-white/90 focus-within:bg-white focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-[#E11D2E]/15 transition-all shadow-xs flex items-center">
            <KeyRound className="pointer-events-none absolute left-4 size-[19px] text-zinc-400" aria-hidden />
            <input
              id="code"
              name="code"
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="w-full h-full bg-transparent pl-12 pr-4 font-mono text-[16px] font-normal tracking-[0.08em] text-zinc-900 placeholder:text-zinc-400 outline-none rounded-xl"
              required
            />
          </div>
          {/* Authenticator Helper Text (IBM Plex Mono 400, 13.5px) */}
          <p className="font-mono text-[13.5px] font-normal leading-normal text-zinc-500 pt-0.5">
            A 6-digit code from your authenticator app, or one unused recovery code.
          </p>
          {fields.code ? <p className="font-sans text-[12px] text-red">{fields.code}</p> : null}
        </div>

        {/* Links Row */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <Link
            href="/forgot-password"
            className="font-sans text-[13.5px] font-medium text-zinc-600 underline underline-offset-4 transition hover:text-ink"
          >
            Forgot password?
          </Link>
          {/* Technical Badge (IBM Plex Mono 500, 12px) */}
          <span className="font-mono text-[12px] font-medium text-zinc-500">2FA is required</span>
        </div>

        {/* Sign-in Button: Horizontal black-to-deep-crimson button (Inter 600, 15.5px, 52px height) */}
        <button
          type="submit"
          disabled={loading}
          className="group relative flex h-[52px] w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#111114] via-[#1a1417] to-[#36090e] border border-black/80 font-sans text-[15.5px] font-semibold text-white shadow-md transition-all duration-200 hover:from-black hover:to-[#4a0d14] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <span>Sign in to workspace</span>
              <ArrowRight className="size-4.5 text-white/80 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
            </>
          )}
        </button>
      </form>

      {/* Footer Notes (Inter 400, 13px, with 600 bold) */}
      <div className="mt-8 border-t border-zinc-200/80 pt-6 font-sans text-[13px] font-normal leading-[1.65] text-zinc-600">
        <p>
          No self sign-up. Accounts are created by an owner from <strong className="font-semibold text-ink">Members</strong>.
        </p>
        <p className="mt-1">Problems signing in? Contact Devendra or Pranav.</p>
      </div>
    </div>
  );
}
