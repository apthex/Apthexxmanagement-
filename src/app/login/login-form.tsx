"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { InlineAlert } from "@/components/portal/ui";

type LoginResponse = { ok: true; redirect: string; name: string; token?: string };

export function LoginForm() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
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
        body: JSON.stringify({ email: email.trim(), password, code: "" }),
      });
      if (result.token) {
        try {
          localStorage.setItem("apt_session", result.token);
          document.cookie = `apt_session=${encodeURIComponent(result.token)}; path=/; max-age=604800; SameSite=Lax; Secure`;
        } catch {}
      }
      window.location.href = result.redirect || "/dashboard";
    } catch (loginError) {
      setError(errorMessage(loginError));
      setFields(fieldErrors(loginError));
      setLoading(false);
    }
  }

  return (
    <div className="w-full rounded-2xl border border-white/[0.12] bg-[#0c0e14]/55 backdrop-blur-2xl p-8 sm:p-10 shadow-[0_24px_64px_rgba(0,0,0,0.7),0_0_40px_rgba(225,29,46,0.08),inset_0_1px_0_rgba(255,255,255,0.12)] relative z-10 transition-all duration-300 hover:border-red-500/30">
      {/* Glass Top Subtle Edge Highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl pointer-events-none" />

      {/* Title */}
      <h1 className="font-display text-2xl sm:text-[28px] font-semibold tracking-tight text-white leading-tight">
        Sign in
      </h1>

      <p className="mt-1.5 text-xs text-zinc-400 mb-6">
        Enter your credentials to continue
      </p>

      {/* Error alert if any */}
      {error ? (
        <InlineAlert tone="error" className="mb-5">
          {error}
        </InlineAlert>
      ) : null}

      <form onSubmit={submit} className="space-y-4" noValidate>
        {/* Work Email Field */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs font-medium text-zinc-300">
            Work email
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

        {/* Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-xs font-medium text-zinc-300">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[11px] text-zinc-400 hover:text-red-400 transition"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative h-11 rounded-xl border border-white/10 bg-[#121520]/60 backdrop-blur-md focus-within:border-red-500/50 focus-within:ring-1 focus-within:ring-red-500/30 transition-all flex items-center">
            <Lock className="pointer-events-none absolute left-3.5 size-4 text-zinc-500" aria-hidden />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full h-full bg-transparent pl-10 pr-10 text-sm text-white placeholder:text-zinc-500 outline-none rounded-xl"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 flex size-7 items-center justify-center rounded-lg text-zinc-500 transition hover:text-zinc-300"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
          {fields.password ? <p className="text-[11px] text-red-400 pt-0.5">{fields.password}</p> : null}
        </div>

        {/* Submit button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="group relative flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-sm font-semibold text-white shadow-[0_0_24px_rgba(225,29,46,0.35)] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                <span>Signing in…</span>
              </>
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="size-4 text-white/80 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
