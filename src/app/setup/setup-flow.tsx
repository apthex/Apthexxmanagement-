"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, Copy, KeyRound, ScanLine, ShieldCheck, TriangleAlert } from "lucide-react";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { InlineAlert, LoadingBlock } from "@/components/portal/ui";
import { AuthShell } from "@/components/auth/auth-shell";

type SetupInfo = {
  mode: "invite" | "reset";
  stage: "password" | "confirm";
  name: string;
  email: string;
  otpauth?: string;
  qrDataUrl?: string;
};

type PasswordResult =
  | { mode: "reset"; completed: true }
  | { mode: "invite"; completed: false; otpauth: string; qrDataUrl: string };

function secretFromUri(uri?: string) {
  if (!uri) return "";
  try {
    return new URL(uri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

function Step({ index, label, active, done }: { index: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold ${
          done
            ? "border-ok bg-ok text-white"
            : active
              ? "border-ink bg-ink text-white"
              : "border-line bg-white text-zinc-400"
        }`}
      >
        {done ? <Check className="size-3" aria-hidden /> : index}
      </span>
      <span className={`text-[10.5px] font-medium ${active || done ? "text-ink" : "text-zinc-400"}`}>{label}</span>
    </div>
  );
}

export function SetupFlow() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [info, setInfo] = React.useState<SetupInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [fatal, setFatal] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[] | null>(null);
  const [savedCodes, setSavedCodes] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setFatal("This setup link is missing its token.");
        setLoading(false);
        return;
      }
      try {
        const data = await apiFetch<SetupInfo>(`/api/auth/setup?token=${encodeURIComponent(token)}`);
        if (!cancelled) setInfo(data);
      } catch (loadError) {
        if (!cancelled) setFatal(errorMessage(loadError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function setNewPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFields({});
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiFetch<PasswordResult>("/api/auth/setup/password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      if (result.mode === "reset") {
        setInfo((current) => (current ? { ...current, stage: "password" } : current));
        setRecoveryCodes([]);
        return;
      }
      setInfo((current) =>
        current
          ? {
              ...current,
              stage: "confirm",
              otpauth: result.otpauth,
              qrDataUrl: result.qrDataUrl,
            }
          : current,
      );
      setPassword("");
      setConfirmPassword("");
    } catch (submitError) {
      setError(errorMessage(submitError));
      setFields(fieldErrors(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmAuthenticator(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFields({});
    setSubmitting(true);
    try {
      const result = await apiFetch<{ ok: true; recoveryCodes: string[] }>("/api/auth/setup/confirm", {
        method: "POST",
        body: JSON.stringify({ token, code }),
      });
      setRecoveryCodes(result.recoveryCodes);
    } catch (submitError) {
      setError(errorMessage(submitError));
      setFields(fieldErrors(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCodes() {
    if (!recoveryCodes?.length) return;
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <AuthShell>
        <LoadingBlock label="Checking your setup link" />
      </AuthShell>
    );
  }

  if (fatal || !info) {
    return (
      <AuthShell>
        <div>
          <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-red-50 text-red">
            <TriangleAlert className="size-5" aria-hidden />
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-ink">Link unavailable</h1>
          <p className="mt-2 text-[12.5px] leading-5 text-zinc-500">{fatal ?? "This setup link is invalid or has expired."}</p>
          <p className="mt-4 text-[11.5px] leading-5 text-zinc-500">
            Setup links expire after 24 hours and can be used once. Ask an owner to issue a new link from Members.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-4 text-[12px] font-medium text-ink hover:bg-zinc-50"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  const step = recoveryCodes ? 3 : info.stage === "confirm" ? 2 : 1;
  const isReset = info.mode === "reset";
  const resetComplete = isReset && recoveryCodes !== null;
  const secret = secretFromUri(info.otpauth);

  return (
    <AuthShell wide>
      <div className="mb-6 flex items-center gap-2.5 border-b border-line pb-4">
        {isReset ? (
          <Step index={1} label="New password" active done={resetComplete} />
        ) : (
          <>
            <Step index={1} label="Password" active={step === 1} done={step > 1} />
            <span className="h-px min-w-3 flex-1 bg-line" aria-hidden />
            <Step index={2} label="Authenticator" active={step === 2} done={step > 2} />
            <span className="h-px min-w-3 flex-1 bg-line" aria-hidden />
            <Step index={3} label="Recovery codes" active={step === 3} done={false} />
          </>
        )}
      </div>

      {resetComplete ? (
        <div>
          <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-green-50 text-ok">
            <CheckCircle2 className="size-5" aria-hidden />
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-ink">Password updated</h1>
          <p className="mt-2 text-[12.5px] leading-5 text-zinc-500">
            Your new password is active. All existing sessions were signed out. Sign in again with your password and
            authenticator code.
          </p>
          <Button variant="primary" className="mt-6 w-full" onClick={() => window.location.assign("/login")}>
            Continue to sign in
          </Button>
        </div>
      ) : recoveryCodes && recoveryCodes.length ? (
        <div>
          <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-green-50 text-ok">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-ink">Save your recovery codes</h1>
          <p className="mt-2 text-[12.5px] leading-5 text-zinc-500">
            Each code works once. Store them somewhere safe and offline. They are shown only on this screen and cannot
            be retrieved later.
          </p>

          <div className="mt-5 rounded-xl border border-line bg-zinc-50 p-4">
            <div className="grid grid-cols-2 gap-2">
              {recoveryCodes.map((recoveryCode) => (
                <code key={recoveryCode} className="rounded-md border border-line bg-white px-2 py-1.5 text-center font-mono text-[11.5px] tracking-[0.03em] text-ink">
                  {recoveryCode}
                </code>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={copyCodes}>
              {copied ? <Check className="size-3.5 text-ok" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copied ? "Copied" : "Copy all codes"}
            </Button>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-[11.5px] leading-5 text-zinc-600">
            <input
              type="checkbox"
              checked={savedCodes}
              onChange={(event) => setSavedCodes(event.target.checked)}
              className="mt-0.5 size-4 rounded border-line accent-red"
            />
            I have saved these recovery codes somewhere private.
          </label>

          <Button
            variant="primary"
            className="mt-5 w-full"
            disabled={!savedCodes}
            onClick={() => window.location.assign("/login")}
          >
            Continue to sign in
          </Button>
        </div>
      ) : info.stage === "confirm" ? (
        <form onSubmit={confirmAuthenticator} noValidate>
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-red">Step 2 of 3</p>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-ink">Connect your authenticator</h1>
          <p className="mt-2 text-[12.5px] leading-5 text-zinc-500">
            Scan the code in your authenticator app, then enter the 6-digit code it shows.
          </p>

          {error ? (
            <InlineAlert tone="error" className="mt-4">
              {error}
            </InlineAlert>
          ) : null}

          <div className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-line bg-zinc-50/70 p-4 sm:flex-row sm:items-start">
            {info.qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={info.qrDataUrl} alt="Authenticator QR code" className="size-[154px] rounded-lg border border-line bg-white p-2" />
            ) : (
              <span className="flex size-[154px] items-center justify-center rounded-lg border border-line bg-white text-zinc-300">
                <ScanLine className="size-9" aria-hidden />
              </span>
            )}
            <div className="min-w-0 text-center sm:text-left">
              <p className="text-[12px] font-medium text-ink">{info.email}</p>
              <p className="mt-1 text-[10.5px] leading-4 text-zinc-500">
                Use any TOTP app: Google Authenticator, 1Password, Authy, or similar.
              </p>
              {secret ? (
                <div className="mt-3">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-zinc-400">Manual key</p>
                  <code className="mt-1 block break-all rounded border border-line bg-white px-2 py-1 font-mono text-[10.5px] text-zinc-600">
                    {secret}
                  </code>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <Field label="6-digit code" htmlFor="setup-code" error={fields.code} required>
              <Input
                id="setup-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                className="text-center font-mono text-[16px] tracking-[0.3em]"
                required
              />
            </Field>
          </div>

          <Button type="submit" variant="primary" className="mt-4 w-full" loading={submitting} disabled={code.length !== 6}>
            Verify and create recovery codes
          </Button>
        </form>
      ) : (
        <form onSubmit={setNewPassword} noValidate>
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-red">
            {isReset ? "Account recovery" : "Step 1 of 3"}
          </p>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-ink">
            {isReset ? "Choose a new password" : "Set up your account"}
          </h1>
          <p className="mt-2 text-[12.5px] leading-5 text-zinc-500">
            {isReset
              ? `Set a new password for ${info.email}. Your authenticator stays the same.`
              : `${info.name}, set a password for ${info.email}. You will connect an authenticator next.`}
          </p>

          {error ? (
            <InlineAlert tone="error" className="mt-4">
              {error}
            </InlineAlert>
          ) : null}

          <div className="mt-5 space-y-4">
            <Field label="New password" htmlFor="new-password" error={fields.password} hint="At least 12 characters. No composition rules." required>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Choose a strong password"
                required
              />
            </Field>
            <Field label="Confirm password" htmlFor="confirm-password" error={fields.confirmPassword} required>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat the password"
                required
              />
            </Field>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="mt-5 w-full"
            loading={submitting}
            disabled={password.length < 12 || confirmPassword.length < 12}
          >
            {isReset ? "Update password" : "Continue to authenticator"}
          </Button>

          {!isReset ? (
            <p className="mt-4 flex items-start gap-1.5 text-[10.5px] leading-4 text-zinc-500">
              <KeyRound className="mt-0.5 size-3 shrink-0" aria-hidden />
              This link is single-use and expires 24 hours after it was issued.
            </p>
          ) : null}
        </form>
      )}
    </AuthShell>
  );
}
