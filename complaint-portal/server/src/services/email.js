import crypto from "crypto";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import EmailOutbox from "../models/EmailOutbox.js";
import { env, isProduction, caseDeskUrl, statusPageUrl } from "../config/env.js";
import { escapeHtml, maskEmail } from "../utils/sanitize.js";
import { generateMonthlyPdf } from "./report.js";

let resendClient = null;
let smtpTransport = null;
let transportOverride = null;

function client() {
  if (!resendClient && env.RESEND_API_KEY) resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
}

function smtpClient() {
  if (!smtpTransport && env.SMTP_USER && env.SMTP_PASS) {
    smtpTransport = nodemailer.createTransport({
      host: env.SMTP_HOST || "smtp.gmail.com",
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return smtpTransport;
}

/** Test-only dependency injection. Never set this from application code. */
export function setEmailTransportForTests(fn) {
  transportOverride = fn;
}

export async function queueEmail({ dedupeKey, to, subject, html, text, kind, meta = {} }) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.EMAIL_OUTBOX_TTL_DAYS * 24 * 60 * 60 * 1000);
  const existing = await EmailOutbox.findOneAndUpdate(
    { dedupe_key: dedupeKey },
    {
      $setOnInsert: {
        dedupe_key: dedupeKey,
        to,
        subject,
        html,
        text,
        kind,
        meta,
        status: "pending",
        attempts: 0,
        next_attempt_at: now,
        created_at: now,
        expires_at: expiresAt,
      },
    },
    { upsert: true, returnDocument: "after" }
  );
  return existing;
}

async function attachmentFor(meta) {
  if (!meta?.institute_name || !meta?.month) return [];
  const pdf = await generateMonthlyPdf({
    instituteName: meta.institute_name,
    month: meta.month,
    received: meta.received || 0,
    completed: meta.completed || 0,
    inProcess: meta.in_process || 0,
  });
  return [{ filename: `apthex-monthly-${meta.month}.pdf`, content: pdf }];
}

async function deliver(message) {
  if (transportOverride) return transportOverride(message);

  // SMTP (Gmail App Password) wins when configured; Resend is the fallback.
  const smtp = smtpClient();
  if (smtp) {
    const info = await smtp.sendMail({
      from: env.EMAIL_FROM || env.SMTP_USER,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: message.attachments?.length ? message.attachments : undefined,
    });
    return { id: info.messageId || `smtp-${crypto.randomUUID()}`, smtp: true };
  }

  if (!env.RESEND_API_KEY) {
    if (!isProduction && env.EMAIL_DEV_LOG) {
      console.log(`[email:dev] kind=${message.kind} to=${maskEmail(message.to)} subject=${message.subject}`);
      return { id: `dev-${crypto.randomUUID()}`, devLogged: true };
    }
    throw new Error("RESEND_API_KEY is not configured");
  }

  const resend = client();
  const result = await resend.emails.send({
    from: env.EMAIL_FROM || "no-reply@example.invalid",
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    attachments: message.attachments?.length ? message.attachments : undefined,
  });
  if (result.error) throw new Error(result.error.message || "Email provider rejected the message");
  return { id: result.data?.id };
}

function backoffMs(attempts) {
  return Math.min(6 * 60 * 60 * 1000, 60 * 1000 * 5 ** Math.max(0, attempts - 1));
}

export async function processOutbox({ limit = 20 } = {}) {
  const summary = { processed: 0, sent: 0, failed: 0, devLogged: 0 };
  const staleLock = new Date(Date.now() - 5 * 60 * 1000);
  await EmailOutbox.updateMany(
    { status: "sending", locked_at: { $lt: staleLock } },
    { $set: { status: "failed", last_error: "Send lock expired before completion" } }
  );

  for (let i = 0; i < limit; i += 1) {
    const now = new Date();
    const message = await EmailOutbox.findOneAndUpdate(
      {
        status: { $in: ["pending", "failed"] },
        next_attempt_at: { $lte: now },
        attempts: { $lt: env.EMAIL_MAX_ATTEMPTS },
      },
      { $set: { status: "sending", locked_at: now }, $inc: { attempts: 1 } },
      { sort: { next_attempt_at: 1 }, returnDocument: "after" }
    );
    if (!message) break;
    summary.processed += 1;

    try {
      const attachments = message.kind === "monthly_report" ? await attachmentFor(message.meta) : [];
      const result = await deliver({
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        kind: message.kind,
        attachments,
      });
      if (result.devLogged) {
        await EmailOutbox.updateOne(
          { _id: message._id },
          {
            $set: {
              status: "dev_logged",
              provider_message_id: result.id,
              sent_at: new Date(),
              locked_at: null,
              last_error: null,
            },
          }
        );
        summary.devLogged += 1;
      } else {
        await EmailOutbox.updateOne(
          { _id: message._id },
          {
            $set: {
              status: "sent",
              provider_message_id: result.id || null,
              sent_at: new Date(),
              locked_at: null,
              last_error: null,
            },
          }
        );
        summary.sent += 1;
      }
    } catch (error) {
      const exhausted = message.attempts >= env.EMAIL_MAX_ATTEMPTS;
      await EmailOutbox.updateOne(
        { _id: message._id },
        {
          $set: {
            status: exhausted ? "dead" : "failed",
            last_error: String(error.message || "Unknown email error").slice(0, 500),
            locked_at: null,
            next_attempt_at: new Date(Date.now() + backoffMs(message.attempts)),
          },
        }
      );
      summary.failed += 1;
      console.error(`[email] delivery failed kind=${message.kind} attempt=${message.attempts}: ${error.message}`);
    }
  }
  return summary;
}

function parseRecipients(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function newComplaintTemplate({ ref_id, institute_code, category, timestamp, urgent }) {
  const safeRef = escapeHtml(ref_id);
  const safeInstitute = escapeHtml(institute_code);
  const safeCategory = escapeHtml(category);
  const safeTimestamp = escapeHtml(timestamp);
  return {
    subject: `${urgent ? "URGENT new complaint" : "New complaint received"} - ${safeRef}`,
    html: `<p>A new complaint has been submitted to the APTHEX Complaint Portal.</p>
      <ul>
        <li><strong>Reference ID:</strong> ${safeRef}</li>
        <li><strong>Institute code:</strong> ${safeInstitute}</li>
        <li><strong>Category:</strong> ${safeCategory}</li>
        <li><strong>Submitted:</strong> ${safeTimestamp}</li>
        <li><strong>Urgent:</strong> ${urgent ? "YES" : "No"}</li>
      </ul>
      <p><a href="${escapeHtml(caseDeskUrl())}">Open the protected APTHEX Case Desk</a></p>
      <p>This alert intentionally contains no complaint description, reporter name, roll number, contact details or attachments.</p>`,
    text: `New complaint ${ref_id}. Institute code ${institute_code}. Category ${category}. Submitted ${timestamp}. Urgent=${urgent ? "YES" : "No"}. Open the Case Desk: ${caseDeskUrl()}`,
  };
}

export function urgentTemplate({ ref_id, institute_code, timestamp }) {
  const safeRef = escapeHtml(ref_id);
  return {
    subject: `URGENT: complaint ${safeRef} requires immediate attention`,
    html: `<p><strong>An urgent complaint has been submitted.</strong></p>
      <ul>
        <li><strong>Reference ID:</strong> ${safeRef}</li>
        <li><strong>Institute code:</strong> ${escapeHtml(institute_code)}</li>
        <li><strong>Submitted:</strong> ${escapeHtml(timestamp)}</li>
      </ul>
      <p><a href="${escapeHtml(caseDeskUrl())}">Open the protected APTHEX Case Desk</a></p>
      <p>No personal information or complaint details are included in this alert.</p>`,
    text: `URGENT complaint ${ref_id}. Institute code ${institute_code}. Submitted ${timestamp}. Open the Case Desk: ${caseDeskUrl()}`,
  };
}

export function reporterConfirmationTemplate({ ref_id }) {
  const safeRef = escapeHtml(ref_id);
  return {
    subject: `Your APTHEX complaint has been received - ${safeRef}`,
    html: `<p>Thank you for contacting APTHEX. Your complaint has been received.</p>
      <p>Your reference ID is <strong>${safeRef}</strong>. Keep it safe and do not share it publicly.</p>
      <p>You can check whether the case is <em>In Process</em> or <em>Completed</em> at <a href="${escapeHtml(statusPageUrl())}">${escapeHtml(statusPageUrl())}</a>. The status page never shows your complaint details.</p>
      <p>This email does not contain confidential complaint details.</p>`,
    text: `Thank you. Your APTHEX complaint reference ID is ${ref_id}. Check status at ${statusPageUrl()}. This email contains no confidential complaint details.`,
  };
}

export function escalationTemplate({ ref_id, institute_code, days }) {
  return {
    subject: `Escalation: complaint open for more than ${days} days`,
    html: `<p>A complaint has remained in process for more than ${escapeHtml(days)} days and requires review.</p>
      <ul>
        <li><strong>Reference ID:</strong> ${escapeHtml(ref_id)}</li>
        <li><strong>Institute code:</strong> ${escapeHtml(institute_code)}</li>
      </ul>
      <p><a href="${escapeHtml(caseDeskUrl())}">Open the protected APTHEX Case Desk</a></p>
      <p>This escalation alert contains no personal information, complaint description or attachments.</p>`,
    text: `Complaint ${ref_id} at institute ${institute_code} has been in process for more than ${days} days. Open the Case Desk: ${caseDeskUrl()}`,
  };
}

export function monthlyReportTemplate({ month }) {
  return {
    subject: `APTHEX monthly complaint report - ${month}`,
    html: `<p>Please find attached the APTHEX monthly aggregate complaint report for ${escapeHtml(month)}.</p>
      <p>The report contains aggregate counts only. It contains no names, complaint descriptions, reference IDs, category breakdowns or attachments.</p>`,
    text: `Please find attached the APTHEX monthly aggregate complaint report for ${month}. The report contains aggregate counts only.`,
  };
}

export async function queueComplaintNotifications({ complaint, reporterEmail = null }) {
  const timestamp = complaint.created_at.toISOString();
  const caseMailbox = env.APTHEX_CASE_MAILBOX;
  const queued = [];

  if (caseMailbox) {
    const template = newComplaintTemplate({
      ref_id: complaint.ref_id,
      institute_code: complaint.institute_code,
      category: complaint.category,
      timestamp,
      urgent: complaint.urgent,
    });
    queued.push(
      await queueEmail({
        dedupeKey: `new:${complaint.ref_id}`,
        to: caseMailbox,
        kind: complaint.urgent ? "urgent" : "new_complaint",
        ...template,
      })
    );
  } else if (!isProduction) {
    console.warn("[email] APTHEX_CASE_MAILBOX is not configured; new-complaint alert was not queued.");
  }

  if (complaint.urgent) {
    const recipients = new Set([caseMailbox, ...parseRecipients(env.URGENT_ALERT_RECIPIENTS)].filter(Boolean));
    for (const recipient of recipients) {
      queued.push(
        await queueEmail({
          dedupeKey: `urgent:${complaint.ref_id}:${recipient}`,
          to: recipient,
          kind: "urgent",
          ...urgentTemplate({
            ref_id: complaint.ref_id,
            institute_code: complaint.institute_code,
            timestamp,
          }),
        })
      );
    }
  }

  if (reporterEmail) {
    queued.push(
      await queueEmail({
        dedupeKey: `confirm:${complaint.ref_id}`,
        to: reporterEmail,
        kind: "reporter_confirmation",
        ...reporterConfirmationTemplate({ ref_id: complaint.ref_id }),
      })
    );
  }

  return queued;
}

export async function queueMonthlyReport({ institute, month, received, completed, inProcess, dedupeSuffix = "" }) {
  if (!institute?.head_email) throw new Error("Institute head email is not configured");
  const template = monthlyReportTemplate({ month });
  return queueEmail({
    dedupeKey: `monthly:${institute.code}:${month}${dedupeSuffix}`,
    to: institute.head_email,
    kind: "monthly_report",
    meta: {
      institute_name: institute.name,
      month,
      received,
      completed,
      in_process: inProcess,
    },
    ...template,
  });
}

export async function queueEscalation({ complaint, days }) {
  const recipients = new Set(
    [env.APTHEX_CASE_MAILBOX, ...parseRecipients(env.URGENT_ALERT_RECIPIENTS)].filter(Boolean)
  );
  const queued = [];
  for (const recipient of recipients) {
    queued.push(
      await queueEmail({
        dedupeKey: `escalation:${complaint.ref_id}:${days}:${recipient}`,
        to: recipient,
        kind: "escalation",
        ...escalationTemplate({
          ref_id: complaint.ref_id,
          institute_code: complaint.institute_code,
          days,
        }),
      })
    );
  }
  return queued;
}

export function staffAccountCreatedTemplate({ name, email, role, password, institute_code, loginUrl }) {
  const isTeacher = role === "case_team";
  const portalUrl = loginUrl || "https://www.apthex.com/admin";
  const roleName = isTeacher ? "Teacher / Case Team" : "Administrator";

  return {
    subject: `APTHEX Case Desk — Staff Account Created`,
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0A0A0C; color: #F5F5F7; border-radius: 12px; border: 1px solid #26262b;">
      <h2 style="color: #E60600; margin-top: 0; font-size: 20px;">APTHEX Case Desk</h2>
      <p style="font-size: 15px;">Hello <strong>${escapeHtml(name)}</strong>,</p>
      <p style="color: #d1d1d6; line-height: 1.5;">Your staff access account has been created on the APTHEX Complaint Management Portal.</p>
      
      <div style="background: #141418; padding: 18px 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #2b2b34;">
        <p style="margin: 6px 0; font-size: 14px;"><strong>Portal Login:</strong> <a href="${escapeHtml(portalUrl)}" style="color: #ff4d4d; font-weight: bold; text-decoration: underline;">${escapeHtml(portalUrl)}</a></p>
        <p style="margin: 6px 0; font-size: 14px;"><strong>Work Email:</strong> ${escapeHtml(email)}</p>
        <p style="margin: 6px 0; font-size: 14px;"><strong>Role:</strong> ${escapeHtml(roleName)}</p>
        ${institute_code ? `<p style="margin: 6px 0; font-size: 14px;"><strong>Institute Code:</strong> <span style="font-family: monospace; color: #ff8080; font-weight: bold;">${escapeHtml(institute_code)}</span></p>` : ""}
        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #22222a;">
          <span style="font-size: 13px; color: #a1a1aa; display: block; margin-bottom: 6px;">Your Login Password:</span>
          <div style="background: #000; padding: 10px 16px; border-radius: 6px; font-family: monospace; font-size: 16px; color: #00ff66; letter-spacing: 1px; display: inline-block; border: 1px solid #1a3322;">
            ${escapeHtml(password)}
          </div>
        </div>
      </div>

      <p style="font-weight: 600; margin-bottom: 8px;">How to Sign In:</p>
      <ol style="padding-left: 20px; color: #d1d1d6; line-height: 1.6; margin-top: 4px;">
        <li>Go to <a href="${escapeHtml(portalUrl)}" style="color: #ff4d4d;">${escapeHtml(portalUrl)}</a></li>
        <li>Enter your staff password above to access the desk${isTeacher ? ` (shows complaint metrics for ${escapeHtml(institute_code)})` : ""}.</li>
      </ol>

      <div style="margin-top: 24px; padding: 14px; background: rgba(255,255,255,0.04); border-radius: 8px; font-size: 13px; color: #9ca3af; border: 1px solid rgba(255,255,255,0.08);">
        <strong>Password Update:</strong> If you need to change your password or update your details, contact your portal administrator or email <a href="mailto:support@apthex.com" style="color: #ff6666;">support@apthex.com</a>.
      </div>

      <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">This is an automated system email from APTHEX. Please keep your credentials confidential.</p>
    </div>`,
    text: `APTHEX Case Desk — Staff Account Created\n\nHello ${name},\n\nYour staff account has been created.\nPortal URL: ${portalUrl}\nWork Email: ${email}\nRole: ${roleName}\n${institute_code ? `Institute Code: ${institute_code}\n` : ""}Password: ${password}\n\nSign in at ${portalUrl} using your password.\n\nTo update your password, contact your portal administrator.`,
  };
}

export function staffPasswordResetTemplate({ name, email, password, institute_code, loginUrl }) {
  const portalUrl = loginUrl || "https://www.apthex.com/admin";
  return {
    subject: `APTHEX Case Desk — Password Updated`,
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0A0A0C; color: #F5F5F7; border-radius: 12px; border: 1px solid #26262b;">
      <h2 style="color: #E60600; margin-top: 0; font-size: 20px;">APTHEX Case Desk</h2>
      <p style="font-size: 15px;">Hello <strong>${escapeHtml(name)}</strong>,</p>
      <p style="color: #d1d1d6; line-height: 1.5;">Your password for the APTHEX Complaint Management Portal has been updated by the administrator.</p>
      
      <div style="background: #141418; padding: 18px 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #2b2b34;">
        <p style="margin: 6px 0; font-size: 14px;"><strong>Portal Login:</strong> <a href="${escapeHtml(portalUrl)}" style="color: #ff4d4d; font-weight: bold; text-decoration: underline;">${escapeHtml(portalUrl)}</a></p>
        <p style="margin: 6px 0; font-size: 14px;"><strong>Account:</strong> ${escapeHtml(email)}</p>
        ${institute_code ? `<p style="margin: 6px 0; font-size: 14px;"><strong>Institute Code:</strong> <span style="font-family: monospace; color: #ff8080; font-weight: bold;">${escapeHtml(institute_code)}</span></p>` : ""}
        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #22222a;">
          <span style="font-size: 13px; color: #a1a1aa; display: block; margin-bottom: 6px;">Your New Password:</span>
          <div style="background: #000; padding: 10px 16px; border-radius: 6px; font-family: monospace; font-size: 16px; color: #00ff66; letter-spacing: 1px; display: inline-block; border: 1px solid #1a3322;">
            ${escapeHtml(password)}
          </div>
        </div>
      </div>

      <p style="color: #d1d1d6; line-height: 1.6;">You can sign in immediately at <a href="${escapeHtml(portalUrl)}" style="color: #ff4d4d;">${escapeHtml(portalUrl)}</a> using this new password.</p>

      <div style="margin-top: 24px; padding: 14px; background: rgba(255,255,255,0.04); border-radius: 8px; font-size: 13px; color: #9ca3af; border: 1px solid rgba(255,255,255,0.08);">
        <strong>Need an update?</strong> If you want to change your password again, request an update from your administrator or contact <a href="mailto:support@apthex.com" style="color: #ff6666;">support@apthex.com</a>.
      </div>

      <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">This is an automated system email from APTHEX. Please keep your credentials confidential.</p>
    </div>`,
    text: `APTHEX Case Desk — Password Updated\n\nHello ${name},\n\nYour password for the APTHEX Case Desk has been updated.\nPortal URL: ${portalUrl}\nAccount: ${email}\n${institute_code ? `Institute Code: ${institute_code}\n` : ""}New Password: ${password}\n\nPlease sign in at ${portalUrl} with your new password.`,
  };
}

export function emailDeliveryConfigured() {
  return Boolean((env.SMTP_USER && env.SMTP_PASS) || (env.RESEND_API_KEY && env.EMAIL_FROM));
}
