import { env } from "@/lib/env";

type EmailInput = {
  to: string[];
  subject: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailHtml(subject: string, text: string): string {
  const paragraphs = text
    .split("\n")
    .map((line) => (line.trim() ? `<p style="margin:0 0 12px">${escapeHtml(line)}</p>` : ""))
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#F4F4F5;font-family:Inter,Arial,sans-serif;color:#17171B">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#71717A;margin-bottom:10px">Apthex · Internal</div>
    <div style="background:#fff;border:1px solid #E4E4E7;border-radius:12px;padding:28px">
      <h1 style="font-size:19px;line-height:1.3;margin:0 0 18px">${escapeHtml(subject)}</h1>
      ${paragraphs}
    </div>
    <p style="font-size:11px;color:#71717A;margin:18px 0 0">Authorised personnel only. Do not forward this email.</p>
  </div></body></html>`;
}

/**
 * Sends through Resend when configured. In local development the message is
 * printed to the server console so invite links and security alerts can be
 * exercised without external credentials. Production does not log message
 * bodies (they can contain setup links).
 */
export async function sendEmail(input: EmailInput): Promise<boolean> {
  const apiKey = env.resendApiKey;
  if (!apiKey) {
    if (env.isProduction) {
      console.error("[email] RESEND_API_KEY is not configured; message not sent");
      return false;
    }
    console.info(`\n[email:dev] to=${input.to.join(", ")} subject=${input.subject}\n${input.text}\n`);
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: emailHtml(input.subject, input.text),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("[email] provider rejected message", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] send failed", error instanceof Error ? error.message : error);
    return false;
  }
}

export function setupEmail(name: string, link: string, kind: "invite" | "reset"): EmailInput {
  if (kind === "invite") {
    return {
      to: [],
      subject: "Set up your Apthex Internal account",
      text: `Hello ${name},\n\nAn owner created an account for you on Apthex Internal, the private operations portal.\n\nSet your password and enrol your authenticator here. This single-use link expires in 24 hours:\n${link}\n\nIf you were not expecting this, contact an owner.`,
    };
  }
  return {
    to: [],
    subject: "Reset your Apthex Internal password",
    text: `Hello ${name},\n\nUse this single-use link to set a new password. It expires in 24 hours:\n${link}\n\nIf you did not request this, you can ignore this email and your password will stay unchanged.`,
  };
}
