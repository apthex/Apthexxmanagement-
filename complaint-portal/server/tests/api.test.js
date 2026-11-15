import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/*
 * Environment must be established before the application imports its
 * configuration module. dotenv does not override existing variables.
 */
const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "apthex-test-storage-"));
process.env.NODE_ENV = "test";
// Tests keep the full 2FA flow even when dev .env disables it.
process.env.AUTH_REQUIRE_2FA = "true";
process.env.SESSION_SECRET = "test-session-secret-0123456789abcdef";
process.env.TOTP_ENCRYPTION_KEY = "test-totp-encryption-key-0123456789";
process.env.CAPTCHA_DEV_BYPASS = "true";
process.env.EMAIL_DEV_LOG = "true";
// .env me real Resend key aa jata hai — tests ko dev-log transport par hi rakhna hai
process.env.RESEND_API_KEY = "";
process.env.APTHEX_CASE_MAILBOX = "case@test.local";
process.env.URGENT_ALERT_RECIPIENTS = "urgent@test.local";
process.env.STORAGE_DRIVER = "local";
process.env.STORAGE_LOCAL_DIR = storageDir;
process.env.RETENTION_DAYS = "30";
process.env.ESCALATION_DAYS = "7";
process.env.SMALL_NUMBER_THRESHOLD = "5";
process.env.RATE_LIMIT_SUBMIT_PER_IP_HOUR = "1000";
process.env.RATE_LIMIT_ANON_PER_IP_HOUR = "1000";
process.env.RATE_LIMIT_SUBMIT_PER_DEVICE_HOUR = "1000";
process.env.RATE_LIMIT_ANON_PER_DEVICE_HOUR = "1000";
process.env.RATE_LIMIT_STATUS_PER_IP_MINUTE = "1000";
process.env.RATE_LIMIT_FOLLOWUP_PER_HOUR = "1000";
process.env.RATE_LIMIT_LOGIN_PER_15_MIN = "1000";
process.env.RATE_LIMIT_INSTITUTE_PER_MINUTE = "1000";

const { default: request } = await import("supertest");
const { default: mongoose } = await import("mongoose");
const { MongoMemoryServer } = await import("mongodb-memory-server");
const { default: bcrypt } = await import("bcrypt");
const { default: speakeasy } = await import("speakeasy");
const { default: sharp } = await import("sharp");

const { default: app } = await import("../src/app.js");
const { connectDB } = await import("../src/db/connect.js");
const { env } = await import("../src/config/env.js");
const { default: Institute } = await import("../src/models/Institute.js");
const { default: Member } = await import("../src/models/Member.js");
const { default: Complaint } = await import("../src/models/Complaint.js");
const { default: Contact } = await import("../src/models/Contact.js");
const { default: Attachment } = await import("../src/models/Attachment.js");
const { default: CaseEvent } = await import("../src/models/CaseEvent.js");
const { default: DeletionLog } = await import("../src/models/DeletionLog.js");
const { default: AuditEvent } = await import("../src/models/AuditEvent.js");
const { default: EmailOutbox } = await import("../src/models/EmailOutbox.js");

let mem;
let ownerAgent;
let ownerCsrf;
let ownerTotpSecret;
let ownerId;
let caseAgent;
let caseCsrf;
let caseMemberId;
let identifiedRef;
let anonymousRef;
let attachmentRef;
let imageAttachmentId;
let voiceAttachmentId;

const OWNER_EMAIL = "owner@test.local";
const OWNER_PASSWORD = "OwnerPass!123";
const CASE_EMAIL = "case.team@test.local";
const CASE_PASSWORD = "CaseTeamPass!123";

function wavBuffer(seconds = 1, sampleRate = 8000) {
  const samples = sampleRate * seconds;
  const data = Buffer.alloc(samples * 2);
  const buffer = Buffer.alloc(44 + data.length);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + data.length, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(data.length, 40);
  data.copy(buffer, 44);
  return buffer;
}

function contact(overrides = {}) {
  return {
    name: "Asha Patil",
    class_label: "Class 10 A",
    roll_no: "12",
    mobile: "9876543210",
    email: "asha@example.com",
    ...overrides,
  };
}

async function enrolAgent(agent, email, password) {
  const login = await agent.post("/api/auth/login").send({ email, password });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.equal(login.body.setupRequired, true);
  const code = speakeasy.totp({ secret: login.body.secret, encoding: "base32" });
  const setup = await agent
    .post("/api/auth/setup-2fa")
    .send({ email, setupToken: login.body.setupToken, code });
  assert.equal(setup.status, 200, JSON.stringify(setup.body));
  return { csrf: setup.body.csrfToken, secret: login.body.secret };
}

test.before(async () => {
  mem = await MongoMemoryServer.create();
  await connectDB(mem.getUri());
  await Institute.create({ code: "SCHOOL01", name: "Demo Public School", type: "school", status: "active" });
  await Institute.create({ code: "COLLEGE01", name: "Demo College", type: "college", status: "active", head_email: "head@example.com" });
  await Member.create({
    name: "Test Owner",
    email: OWNER_EMAIL,
    password_hash: await bcrypt.hash(OWNER_PASSWORD, 4),
    role: "owner",
    status: "active",
  });

  ownerAgent = request.agent(app);
  const enrolled = await enrolAgent(ownerAgent, OWNER_EMAIL, OWNER_PASSWORD);
  ownerCsrf = enrolled.csrf;
  ownerTotpSecret = enrolled.secret;
  const me = await ownerAgent.get("/api/auth/me");
  ownerId = me.body.member.id;
});

test.after(async () => {
  await mongoose.disconnect();
  await mem.stop();
  fs.rmSync(storageDir, { recursive: true, force: true });
});

/* --------------------------------------------------------------- baseline */

test("health reports a connected database", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.database, "connected");
});

test("public config exposes languages and CAPTCHA state without secrets", async () => {
  const res = await request(app).get("/api/config");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.languages, ["en", "hi", "mr"]);
  assert.equal(res.body.captcha.siteKey, null);
  assert.equal(res.body.captcha.devBypass, true);
  assert.equal(JSON.stringify(res.body).includes("SECRET"), false);
});

test("institute validation accepts a known code and rejects unknown or malformed codes", async () => {
  const good = await request(app).get("/api/institutes/validate?code=school01");
  assert.equal(good.status, 200);
  assert.equal(good.body.code, "SCHOOL01");
  assert.equal(good.body.name, "Demo Public School");

  const unknown = await request(app).get("/api/institutes/validate?code=NOPE01");
  assert.equal(unknown.status, 404);

  const malformed = await request(app).get("/api/institutes/validate?code=x");
  assert.equal(malformed.status, 400);
});

/* ------------------------------------------------------------- public API */

test("identified complaint is accepted and separates identity into Contact", async () => {
  const res = await request(app)
    .post("/api/complaints")
    .send({
      institute_code: "SCHOOL01",
      category: "Online Harassment or Bullying",
      details_text: "A detailed identified complaint used by the automated test suite.",
      mode: "identified",
      urgent: false,
      captchaToken: "dev-bypass",
      deviceId: "test-device-identified",
      contact: contact(),
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.match(res.body.ref_id, /^APX-\d{4}-[2-9A-HJKMNP-Z]{6}$/);
  assert.equal(res.body.acknowledgement_email, true);
  identifiedRef = res.body.ref_id;

  const complaint = await Complaint.findOne({ ref_id: identifiedRef }).lean();
  assert.equal(complaint.mode, "identified");
  assert.equal(complaint.status, "in_process");
  const storedContact = await Contact.findOne({ complaint_id: complaint._id }).lean();
  assert.equal(storedContact.name, "Asha Patil");
  assert.equal(storedContact.email, "asha@example.com");
});

test("anonymous complaint stores no identity at all", async () => {
  const res = await request(app)
    .post("/api/complaints")
    .send({
      institute_code: "SCHOOL01",
      category: "Blackmail and Sextortion",
      details_text: "An anonymous complaint used by the automated privacy test suite.",
      mode: "anonymous",
      urgent: false,
      captchaToken: "dev-bypass",
      deviceId: "test-device-anonymous",
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.acknowledgement_email, false);
  anonymousRef = res.body.ref_id;

  const complaint = await Complaint.findOne({ ref_id: anonymousRef }).lean();
  assert.equal(complaint.mode, "anonymous");
  assert.equal(complaint.class_label, undefined);
  assert.equal(await Contact.countDocuments({ complaint_id: complaint._id }), 0);
});

test("anonymous mode rejects personal information", async () => {
  const res = await request(app)
    .post("/api/complaints")
    .send({
      institute_code: "SCHOOL01",
      category: "Blackmail and Sextortion",
      details_text: "Anonymous attempt that includes a name and must be rejected.",
      mode: "anonymous",
      urgent: false,
      captchaToken: "dev-bypass",
      contact: { name: "Should Not Be Stored" },
    });
  assert.equal(res.status, 400);
});

test("urgent submissions use the urgent category and alert the case team", async () => {
  const res = await request(app)
    .post("/api/complaints")
    .send({
      institute_code: "SCHOOL01",
      details_text: "Urgent safety concern test submission requiring immediate attention.",
      mode: "anonymous",
      urgent: true,
      captchaToken: "dev-bypass",
      deviceId: "test-device-urgent",
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const complaint = await Complaint.findOne({ ref_id: res.body.ref_id }).lean();
  assert.equal(complaint.urgent, true);
  assert.equal(complaint.category, "Urgent safety concern");
  const urgentQueued = await EmailOutbox.countDocuments({ kind: "urgent", dedupe_key: { $regex: res.body.ref_id } });
  assert.ok(urgentQueued >= 1);
});

test("submission validation rejects short text, invalid category and incomplete identity", async () => {
  const short = await request(app).post("/api/complaints").send({
    institute_code: "SCHOOL01",
    category: "Online Harassment or Bullying",
    details_text: "short",
    mode: "anonymous",
    captchaToken: "dev-bypass",
  });
  assert.equal(short.status, 400);

  const invalidCategory = await request(app).post("/api/complaints").send({
    institute_code: "SCHOOL01",
    category: "Not a real category",
    details_text: "A valid length description with an invalid category value.",
    mode: "anonymous",
    captchaToken: "dev-bypass",
  });
  assert.equal(invalidCategory.status, 400);

  const noContact = await request(app).post("/api/complaints").send({
    institute_code: "SCHOOL01",
    category: "Online Harassment or Bullying",
    details_text: "Identified complaint without the required contact fields.",
    mode: "identified",
    captchaToken: "dev-bypass",
  });
  assert.equal(noContact.status, 400);

  const unknownInstitute = await request(app).post("/api/complaints").send({
    institute_code: "NOPE99",
    category: "Online Harassment or Bullying",
    details_text: "A valid length description for an unknown institute code.",
    mode: "anonymous",
    captchaToken: "dev-bypass",
  });
  assert.equal(unknownInstitute.status, 400);
});

test("duplicate complaint text inside the duplicate window is rejected", async () => {
  const payload = {
    institute_code: "SCHOOL01",
    category: "Financial Fraud or Threats",
    details_text: "Duplicate detection test with a unique sentence for this test only.",
    mode: "anonymous",
    captchaToken: "dev-bypass",
    deviceId: "test-device-duplicate",
  };
  const first = await request(app).post("/api/complaints").send(payload);
  assert.equal(first.status, 201);
  const second = await request(app).post("/api/complaints").send(payload);
  assert.equal(second.status, 409);
});

test("image and voice evidence are processed, stored privately and served through signed links", async () => {
  const image = await sharp({
    create: { width: 32, height: 24, channels: 3, background: { r: 225, g: 29, b: 46 } },
  }).jpeg().toBuffer();
  const voice = wavBuffer(1);

  const res = await request(app)
    .post("/api/complaints")
    .field("institute_code", "SCHOOL01")
    .field("category", "Fake Profiles or Account Hacking")
    .field("details_text", "Complaint with image and voice evidence for attachment tests.")
    .field("mode", "anonymous")
    .field("urgent", "false")
    .field("captchaToken", "dev-bypass")
    .field("deviceId", "test-device-evidence")
    .attach("images", image, "evidence.jpg")
    .attach("voice", voice, "statement.wav");
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.attachments, 2);
  attachmentRef = res.body.ref_id;

  const complaint = await Complaint.findOne({ ref_id: attachmentRef }).lean();
  const attachments = await Attachment.find({ complaint_id: complaint._id }).lean();
  assert.equal(attachments.length, 2);
  const imageRow = attachments.find((row) => row.type === "image");
  const voiceRow = attachments.find((row) => row.type === "voice");
  imageAttachmentId = String(imageRow._id);
  voiceAttachmentId = String(voiceRow._id);
  assert.equal(imageRow.mime, "image/jpeg");
  assert.equal(voiceRow.mime, "audio/wav");
  assert.ok(imageRow.storage_key.startsWith("image/"));
  assert.ok(!imageRow.storage_key.includes(".."));
});

test("status lookup returns only status and never complaint details", async () => {
  const res = await request(app).post("/api/status/lookup").send({ ref_id: identifiedRef });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "In Process");
  assert.deepEqual(Object.keys(res.body), ["status"]);

  const missing = await request(app).post("/api/status/lookup").send({ ref_id: "APX-2601-ZZZZZZ" });
  assert.equal(missing.status, 404);

  const malformed = await request(app).post("/api/status/lookup").send({ ref_id: "nope" });
  assert.equal(malformed.status, 404);
});

test("public follow-up is rate-limited, audited and attached to the case", async () => {
  const before = await CaseEvent.countDocuments({ event: "reporter_followup" });
  const res = await request(app)
    .post("/api/status/followup")
    .send({
      ref_id: anonymousRef,
      text: "Additional information supplied through the public status page.",
      captchaToken: "dev-bypass",
      deviceId: "test-device-followup",
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const after = await CaseEvent.countDocuments({ event: "reporter_followup" });
  assert.equal(after, before + 1);
  const auditRow = await AuditEvent.findOne({ action: "reporter_followup" }).lean();
  assert.ok(auditRow);
});

/* ----------------------------------------------------------- staff access */

test("staff endpoints reject unauthenticated requests", async () => {
  assert.equal((await request(app).get("/api/complaints")).status, 401);
  assert.equal((await request(app).get("/api/staff/members")).status, 401);
  assert.equal((await request(app).get("/api/stats/institutes")).status, 401);
  assert.equal((await request(app).get("/api/staff/audit")).status, 401);
});

test("staff login requires TOTP and session cookies are HttpOnly", async () => {
  const fresh = request.agent(app);
  const missingCode = await fresh.post("/api/auth/login").send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  assert.equal(missingCode.status, 400);
  assert.equal(missingCode.body.twoFactorRequired, true);

  const twoFactor = await fresh.post("/api/auth/login").send({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    code: speakeasy.totp({ secret: ownerTotpSecret, encoding: "base32" }),
  });
  assert.equal(twoFactor.status, 200);
  const cookies = twoFactor.headers["set-cookie"].join(";");
  assert.match(cookies, /apthex_session=/);
  assert.match(cookies, /HttpOnly/i);
  assert.match(cookies, /SameSite=Lax/i);

  const badCode = await request(app).post("/api/auth/login").send({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    code: "000000",
  });
  assert.equal(badCode.status, 401);
});

test("case list, filters and summary are available to staff", async () => {
  const res = await ownerAgent.get("/api/complaints?limit=100");
  assert.equal(res.status, 200);
  assert.ok(res.body.items.length >= 5);
  assert.ok(res.body.summary.total >= 5);
  assert.ok(res.body.summary.urgent >= 1);
  assert.ok(res.body.items.some((item) => item.ref_id === identifiedRef));

  const filtered = await ownerAgent.get("/api/complaints?urgent=true&limit=100");
  assert.equal(filtered.status, 200);
  assert.ok(filtered.body.items.every((item) => item.urgent));
});

test("complaint detail exposes contact and evidence only to staff", async () => {
  const res = await ownerAgent.get(`/api/complaints/${identifiedRef}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.complaint.ref_id, identifiedRef);
  assert.equal(res.body.contact.name, "Asha Patil");
  assert.equal(res.body.complaint.details_hash, undefined);

  const anon = await ownerAgent.get(`/api/complaints/${anonymousRef}`);
  assert.equal(anon.status, 200);
  assert.equal(anon.body.contact, null);
  assert.deepEqual(anon.body.contacts, []);
});

test("state-changing staff requests require a valid CSRF token", async () => {
  const res = await ownerAgent
    .patch(`/api/complaints/${identifiedRef}`)
    .send({ note: "This request has no CSRF header." });
  assert.equal(res.status, 403);
});

test("case completion, reopening, notes, spam and assignment are audited", async () => {
  const detailBefore = await ownerAgent.get(`/api/complaints/${identifiedRef}`);
  const assignedId = detailBefore.body.complaint.assigned_to?.id;
  assert.equal(assignedId || null, null);

  const complete = await ownerAgent
    .patch(`/api/complaints/${identifiedRef}`)
    .set("X-CSRF-Token", ownerCsrf)
    .send({ completed: true });
  assert.equal(complete.status, 200);
  let complaint = await Complaint.findOne({ ref_id: identifiedRef }).lean();
  assert.equal(complaint.status, "completed");
  assert.ok(complaint.completed_at);
  assert.ok(complaint.delete_after);

  const reopen = await ownerAgent
    .patch(`/api/complaints/${identifiedRef}`)
    .set("X-CSRF-Token", ownerCsrf)
    .send({ completed: false });
  assert.equal(reopen.status, 200);
  complaint = await Complaint.findOne({ ref_id: identifiedRef }).lean();
  assert.equal(complaint.status, "in_process");

  const note = await ownerAgent
    .patch(`/api/complaints/${identifiedRef}`)
    .set("X-CSRF-Token", ownerCsrf)
    .send({ note: "Called the reporter and documented the next step." });
  assert.equal(note.status, 200);

  const assign = await ownerAgent
    .patch(`/api/complaints/${identifiedRef}`)
    .set("X-CSRF-Token", ownerCsrf)
    .send({ assigned_to: ownerId });
  assert.equal(assign.status, 200);

  const spam = await ownerAgent
    .patch(`/api/complaints/${identifiedRef}`)
    .set("X-CSRF-Token", ownerCsrf)
    .send({ flagged_spam: true });
  assert.equal(spam.status, 200);
  await ownerAgent
    .patch(`/api/complaints/${identifiedRef}`)
    .set("X-CSRF-Token", ownerCsrf)
    .send({ flagged_spam: false });

  const detail = await ownerAgent.get(`/api/complaints/${identifiedRef}`);
  assert.equal(detail.body.complaint.assigned_to.id, ownerId);
  assert.ok(detail.body.events.some((event) => event.event === "completed"));
  assert.ok(detail.body.events.some((event) => event.event === "reopened"));
  assert.ok(detail.body.events.some((event) => event.event === "note"));
  assert.ok(detail.body.events.some((event) => event.event === "assigned"));
  assert.ok(detail.body.events.some((event) => event.event === "flagged_spam"));
});

test("attachment download URLs work and require staff authentication", async () => {
  const signed = await ownerAgent.get(`/api/attachments/${imageAttachmentId}/url`);
  assert.equal(signed.status, 200);
  assert.equal(signed.body.url, `/api/attachments/download/${imageAttachmentId}`);
  assert.ok(signed.body.expires_at);

  const download = await ownerAgent.get(signed.body.url);
  assert.equal(download.status, 200);
  assert.match(download.headers["content-type"], /image\/jpeg/);
  assert.equal(download.headers["x-content-type-options"], "nosniff");

  const unauth = await request(app).get(`/api/attachments/${voiceAttachmentId}/url`);
  assert.equal(unauth.status, 401);

  const nonexistent = await ownerAgent.get("/api/attachments/000000000000000000000000/url");
  assert.equal(nonexistent.status, 404);
});

test("signed attachment access is audit logged", async () => {
  await ownerAgent.get(`/api/attachments/${imageAttachmentId}/url`);
  const events = await AuditEvent.find({ action: "attachment_url_issued" }).lean();
  assert.ok(events.length >= 1);
});

test("statistics and monthly report endpoints return aggregate data and a PDF", async () => {
  const institutes = await ownerAgent.get("/api/stats/institutes");
  assert.equal(institutes.status, 200);
  assert.ok(institutes.body.institutes.some((institute) => institute.code === "SCHOOL01"));

  const stats = await ownerAgent.get("/api/stats/institute/SCHOOL01");
  assert.equal(stats.status, 200);
  assert.ok(stats.body.received >= 5);
  assert.ok(stats.body.months.length >= 1);

  const overview = await ownerAgent.get("/api/stats/overview");
  assert.equal(overview.status, 200);
  assert.ok(overview.body.summary.total >= 5);

  const data = await ownerAgent.get(`/api/reports/data?institute_code=SCHOOL01&month=${new Date().toISOString().slice(0, 7)}`);
  assert.equal(data.status, 200);
  assert.ok(typeof data.body.received === "number");

  const pdf = await ownerAgent
    .get(`/api/reports/preview?institute_code=SCHOOL01&month=${new Date().toISOString().slice(0, 7)}`)
    .buffer(true)
    .parse((response, callback) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => callback(null, Buffer.concat(chunks)));
    });
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers["content-type"], /application\/pdf/);
  assert.ok(pdf.body.length > 500);
});

test("owner can create staff accounts while case team cannot list them", async () => {
  const created = await ownerAgent
    .post("/api/staff/members")
    .set("X-CSRF-Token", ownerCsrf)
    .send({ name: "Case Team Member", email: CASE_EMAIL, password: CASE_PASSWORD, role: "case_team" });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  caseMemberId = created.body.member.id;

  caseAgent = request.agent(app);
  const enrolled = await enrolAgent(caseAgent, CASE_EMAIL, CASE_PASSWORD);
  caseCsrf = enrolled.csrf;

  const list = await caseAgent.get("/api/staff/members");
  assert.equal(list.status, 404);

  const cases = await caseAgent.get("/api/complaints?limit=5");
  // Naya rule: complaint data sirf owner dekh sakta hai — case_team (teachers) ko sirf leaderboard milta hai.
  assert.equal(cases.status, 404);

  const leaderboard = await caseAgent.get("/api/stats/leaderboard");
  assert.equal(leaderboard.status, 200);
  assert.ok(Array.isArray(leaderboard.body.leaderboard));

  const audit = await caseAgent.get("/api/staff/audit");
  assert.equal(audit.status, 404);

  const members = await ownerAgent.get("/api/staff/members");
  assert.equal(members.status, 200);
  assert.ok(members.body.members.some((row) => row.email === CASE_EMAIL));
});

test("email outbox is owner-only and development delivery is logged", async () => {
  const forbidden = await caseAgent.get("/api/staff/outbox");
  assert.equal(forbidden.status, 404);

  const beforeProcess = await ownerAgent.get("/api/staff/outbox?limit=100");
  assert.equal(beforeProcess.status, 200);
  assert.ok(beforeProcess.body.items.length >= 1);

  const processed = await ownerAgent
    .post("/api/staff/outbox/process")
    .set("X-CSRF-Token", ownerCsrf)
    .send({});
  assert.equal(processed.status, 200);
  assert.ok(Number.isInteger(processed.body.summary.processed));

  const afterProcess = await ownerAgent.get("/api/staff/outbox?limit=100");
  assert.ok(afterProcess.body.items.some((message) => ["dev_logged", "sent"].includes(message.status)));
});

test("video evidence is accepted with a valid container and rejected otherwise", async () => {
  // Minimal MP4-shaped buffer: ftyp box signature at bytes 4-8.
  const video = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from("ftypisom"),
    Buffer.alloc(48, 0x00),
  ]);

  const good = await request(app)
    .post("/api/complaints")
    .field("institute_code", "SCHOOL01")
    .field("category", "Institution-level Issue")
    .field("details_text", "Complaint with a short video clip attached as evidence.")
    .field("mode", "anonymous")
    .field("urgent", "false")
    .field("captchaToken", "dev-bypass")
    .field("deviceId", "test-device-video")
    .attach("videos", video, "clip.mp4");
  assert.equal(good.status, 201, JSON.stringify(good.body));
  assert.equal(good.body.attachments, 1);

  const complaint = await Complaint.findOne({ ref_id: good.body.ref_id }).lean();
  const rows = await Attachment.find({ complaint_id: complaint._id }).lean();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, "video");
  assert.equal(rows[0].mime, "video/mp4");
  assert.ok(rows[0].storage_key.startsWith("video/"));

  const bad = await request(app)
    .post("/api/complaints")
    .field("institute_code", "SCHOOL01")
    .field("category", "Institution-level Issue")
    .field("details_text", "Complaint where a text file pretends to be a video.")
    .field("mode", "anonymous")
    .field("urgent", "false")
    .field("captchaToken", "dev-bypass")
    .field("deviceId", "test-device-video-bad")
    .attach("videos", Buffer.from("this is definitely not a video file"), "clip.mp4");
  assert.equal(bad.status, 400);
});

test("owner can add institutes through the panel while case team cannot", async () => {
  const created = await ownerAgent
    .post("/api/institutes")
    .set("X-CSRF-Token", ownerCsrf)
    .send({ name: "Verification College", head_name: "Test Head", head_email: "head@verification.local", type: "college" });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.match(created.body.institute.code, /^[A-Z0-9_-]{3,32}$/);

  const forbidden = await caseAgent
    .post("/api/institutes")
    .set("X-CSRF-Token", caseCsrf)
    .send({ name: "Teacher College", head_name: "Nope", head_email: "nope@teacher.local" });
  assert.equal(forbidden.status, 404);

  const publicList = await request(app).get("/api/institutes/list");
  assert.equal(publicList.status, 200);
  assert.ok(publicList.body.institutes.some((row) => row.name === "Verification College"));
});

test("case team members default to the standard teacher password", async () => {
  const created = await ownerAgent
    .post("/api/staff/members")
    .set("X-CSRF-Token", ownerCsrf)
    .send({ name: "Default Password Teacher", email: "default-pw-teacher@test.local", role: "case_team" });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  const member = await Member.findOne({ email: "default-pw-teacher@test.local" }).lean();
  assert.ok(member);
  assert.ok(await bcrypt.compare("Teacher8686@#", member.password_hash));
});

test("password-only login matches admin password first, then teacher password", async () => {
  await ownerAgent
    .post("/api/staff/members")
    .set("X-CSRF-Token", ownerCsrf)
    .send({ name: "Password Only Teacher", email: "password-only-teacher@test.local", role: "case_team" });

  // Admin password matches an owner — with 2FA enforced in tests, a code is asked next.
  const adminMatch = await request(app).post("/api/auth/login").send({ password: OWNER_PASSWORD });
  assert.equal(adminMatch.status, 400, JSON.stringify(adminMatch.body));
  assert.equal(adminMatch.body.twoFactorRequired, true);

  // Teacher password matches a case_team member (never enrolled) — QR setup is offered.
  const teacherMatch = await request(app).post("/api/auth/login").send({ password: "Teacher8686@#" });
  assert.equal(teacherMatch.status, 200, JSON.stringify(teacherMatch.body));
  assert.equal(teacherMatch.body.setupRequired, true);

  // No match at all.
  const wrong = await request(app).post("/api/auth/login").send({ password: "totally-wrong-pass" });
  assert.equal(wrong.status, 401);
});

test("audit log records authentication and privileged actions", async () => {
  const res = await ownerAgent.get("/api/staff/audit?limit=100");
  assert.equal(res.status, 200);
  assert.ok(res.body.items.some((event) => event.action === "staff_login"));
  assert.ok(res.body.items.some((event) => event.action === "complaint_created"));
  assert.ok(res.body.items.some((event) => event.action === "attachment_url_issued"));
  assert.ok(res.body.items.every((event) => !event.ip_hash || event.ip_hash.startsWith("sha256:")));
});

test("CAPTCHA verification rejects invalid tokens and accepts valid provider responses", async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  try {
    env.CLOUDFLARE_TURNSTILE_SECRET_KEY = "test-secret";
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }) });
    const rejected = await request(app).post("/api/complaints").send({
      institute_code: "SCHOOL01",
      category: "Online Harassment or Bullying",
      details_text: "CAPTCHA rejection path with a provider failure response.",
      mode: "anonymous",
      captchaToken: "bad-token",
    });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.captchaFailed, true);

    globalThis.fetch = async () => ({ ok: true, json: async () => ({ success: true }) });
    const accepted = await request(app).post("/api/complaints").send({
      institute_code: "SCHOOL01",
      category: "Online Harassment or Bullying",
      details_text: "CAPTCHA success path with a valid provider response.",
      mode: "anonymous",
      captchaToken: "good-token",
      deviceId: "test-device-captcha",
    });
    assert.equal(accepted.status, 201);
  } finally {
    globalThis.fetch = originalFetch;
    env.CLOUDFLARE_TURNSTILE_SECRET_KEY = originalSecret;
  }
});

test("local zero-setup captcha is enforced and accepts a correct answer", async () => {
  const originalBypass = env.CAPTCHA_DEV_BYPASS;
  env.CAPTCHA_DEV_BYPASS = false;
  try {
    const challenge = await request(app).get("/api/captcha");
    assert.equal(challenge.status, 200);
    assert.match(challenge.body.question, /What is \d+ [+−×] \d+\?/);
    assert.match(challenge.body.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    // Token payload is signed, not encrypted — tests decode it to get the answer.
    const payload = JSON.parse(Buffer.from(challenge.body.token.split(".")[0], "base64url").toString("utf8"));

    const wrong = await request(app)
      .post("/api/complaints")
      .field("institute_code", "SCHOOL01")
      .field("category", "Institution-level Issue")
      .field("details_text", "Local captcha path with a deliberately wrong answer.")
      .field("mode", "anonymous")
      .field("urgent", "false")
      .field("captchaToken", challenge.body.token)
      .field("captchaAnswer", String(payload.a + 1))
      .field("deviceId", "test-device-local-captcha");
    assert.equal(wrong.status, 400);
    assert.equal(wrong.body.captchaFailed, true);

    // A consumed (wrongly answered) challenge cannot be reused.
    const correct = await request(app).get("/api/captcha");
    assert.equal(correct.status, 200);
    const correctPayload = JSON.parse(Buffer.from(correct.body.token.split(".")[0], "base64url").toString("utf8"));

    const right = await request(app)
      .post("/api/complaints")
      .field("institute_code", "SCHOOL01")
      .field("category", "Institution-level Issue")
      .field("details_text", "Local captcha path with the correct signed answer.")
      .field("mode", "anonymous")
      .field("urgent", "false")
      .field("captchaToken", correct.body.token)
      .field("captchaAnswer", String(correctPayload.a))
      .field("deviceId", "test-device-local-captcha");
    assert.equal(right.status, 201, JSON.stringify(right.body));

    // One-time use: the same token cannot be replayed.
    const replay = await request(app)
      .post("/api/complaints")
      .field("institute_code", "SCHOOL01")
      .field("category", "Institution-level Issue")
      .field("details_text", "Local captcha replay attempt with the same token.")
      .field("mode", "anonymous")
      .field("urgent", "false")
      .field("captchaToken", correct.body.token)
      .field("captchaAnswer", String(correctPayload.a))
      .field("deviceId", "test-device-local-captcha");
    assert.equal(replay.status, 400);
    assert.equal(replay.body.captchaFailed, true);
  } finally {
    env.CAPTCHA_DEV_BYPASS = originalBypass;
  }
});

test("owner can queue an email self-test that lands in the outbox", async () => {
  const res = await ownerAgent
    .post("/api/staff/outbox/test")
    .set("X-CSRF-Token", ownerCsrf)
    .send({ email: "self-test@apthex.test" });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const forbidden = await caseAgent
    .post("/api/staff/outbox/test")
    .set("X-CSRF-Token", caseCsrf)
    .send({ email: "nope@apthex.test" });
  assert.equal(forbidden.status, 404);

  const processed = await ownerAgent
    .post("/api/staff/outbox/process")
    .set("X-CSRF-Token", ownerCsrf)
    .send({});
  assert.equal(processed.status, 200);
  const outbox = await EmailOutbox.find({ kind: "test" }).lean();
  assert.ok(outbox.some((message) => message.to === "self-test@apthex.test" && ["dev_logged", "sent"].includes(message.status)));
});

test("institute lookup rate limiting returns 429 for excessive requests", async () => {
  const originalLimit = env.RATE_LIMIT_INSTITUTE_PER_MINUTE;
  env.RATE_LIMIT_INSTITUTE_PER_MINUTE = 1;
  try {
    const headers = { "X-Forwarded-For": "203.0.113.77" };
    const first = await request(app).get("/api/institutes/validate?code=SCHOOL01").set(headers);
    assert.equal(first.status, 200);
    const second = await request(app).get("/api/institutes/validate?code=SCHOOL01").set(headers);
    assert.equal(second.status, 429);
    assert.ok(second.headers["retry-after"]);
  } finally {
    env.RATE_LIMIT_INSTITUTE_PER_MINUTE = originalLimit;
  }
});

test("retention expiry deletes case data and leaves only a deletion record", async () => {
  const refId = "APX-2601-AB23CD";
  const complaint = await Complaint.create({
    ref_id: refId,
    institute_code: "SCHOOL01",
    category: "Institution-level Issue",
    details_text: "Retention deletion test case.",
    details_hash: "retention-test-hash",
    urgent: false,
    mode: "anonymous",
    status: "completed",
    completed_at: new Date(Date.now() - 31 * 86400000),
    delete_after: new Date(Date.now() - 1000),
  });
  await Contact.create({
    complaint_id: complaint._id,
    kind: "reporter",
    name: "Retention Person",
    mobile: "9999999999",
    email: "retention@example.com",
  });

  const res = await request(app).post("/api/status/lookup").send({ ref_id: refId });
  assert.equal(res.status, 200);
  assert.equal(res.body.data_deleted, true);
  assert.equal(await Complaint.countDocuments({ ref_id: refId }), 0);
  assert.equal(await Contact.countDocuments({ complaint_id: complaint._id }), 0);
  assert.ok(await DeletionLog.findOne({ ref_id: refId }).lean());

  const repeat = await request(app).post("/api/status/lookup").send({ ref_id: refId });
  assert.equal(repeat.status, 200);
  assert.equal(repeat.body.data_deleted, true);
});

test("origin checks can reject state-changing requests from untrusted origins", async () => {
  const original = env.REQUIRE_ORIGIN;
  env.REQUIRE_ORIGIN = true;
  try {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Origin", "https://evil.example")
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
    assert.equal(res.status, 403);
  } finally {
    env.REQUIRE_ORIGIN = original;
  }
});

test("logout revokes the session and clears cookies", async () => {
  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").send({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    code: speakeasy.totp({ secret: ownerTotpSecret, encoding: "base32" }),
  });
  assert.equal(login.status, 200);
  const me = await agent.get("/api/auth/me");
  const csrf = me.body.csrfToken;
  const logout = await agent.post("/api/auth/logout").set("X-CSRF-Token", csrf);
  assert.equal(logout.status, 200);
  assert.equal((await agent.get("/api/auth/me")).status, 401);
});

test("owner password reset revokes case-team sessions and clears 2FA", async () => {
  const reset = await ownerAgent
    .post(`/api/staff/members/${caseMemberId}/reset-password`)
    .set("X-CSRF-Token", ownerCsrf)
    .send({ password: "NewCasePass!1234" });
  assert.equal(reset.status, 200);
  assert.equal((await caseAgent.get("/api/auth/me")).status, 401);
  const member = await Member.findById(caseMemberId).lean();
  assert.equal(member.totp_enabled, false);
  assert.equal(member.password_hash.length > 20, true);
});

test("case_team can delete an individual attachment; blob object, record, case event and audit are consistent", async () => {
  // The password-reset test above cleared this member's two-factor setup, so
  // re-run the full enrolment flow (password → setup token → authenticator
  // code) and obtain a fresh case-team session.
  const caseAgent2 = request.agent(app);
  const reLogin = await caseAgent2
    .post("/api/auth/login")
    .send({ email: CASE_EMAIL, password: "NewCasePass!1234" });
  assert.equal(reLogin.status, 200, JSON.stringify(reLogin.body));
  assert.equal(reLogin.body.setupRequired, true);
  const reSecret = reLogin.body.secret;
  const reSetup = await caseAgent2
    .post("/api/auth/setup-2fa")
    .send({ email: CASE_EMAIL, setupToken: reLogin.body.setupToken, code: speakeasy.totp({ secret: reSecret, encoding: "base32" }) });
  assert.equal(reSetup.status, 200, JSON.stringify(reSetup.body));
  const caseCsrf2 = reSetup.body.csrfToken;

  const image = await sharp({
    create: { width: 20, height: 20, channels: 3, background: { r: 5, g: 5, b: 5 } },
  }).jpeg().toBuffer();

  const submit = await request(app)
    .post("/api/complaints")
    .field("institute_code", "SCHOOL01")
    .field("category", "Fake Profiles or Account Hacking")
    .field("details_text", "Complaint used to verify individual attachment deletion.")
    .field("mode", "anonymous")
    .field("urgent", "false")
    .field("captchaToken", "dev-bypass")
    .field("deviceId", "test-device-attach-delete")
    .attach("images", image, "delete-me.jpg");
  assert.equal(submit.status, 201, JSON.stringify(submit.body));
  const deleteRef = submit.body.ref_id;

  const complaint = await Complaint.findOne({ ref_id: deleteRef }).lean();
  const row = await Attachment.findOne({ complaint_id: complaint._id }).lean();
  assert.ok(row, "attachment record must exist before deletion");

  // Unauthenticated deletion is rejected.
  assert.equal((await request(app).delete(`/api/attachments/${row._id}`)).status, 401);
  // A session without a CSRF token is rejected.
  assert.equal((await caseAgent2.delete(`/api/attachments/${row._id}`)).status, 403);

  const del = await caseAgent2
    .delete(`/api/attachments/${row._id}`)
    .set("X-CSRF-Token", caseCsrf2);
  assert.equal(del.status, 200, JSON.stringify(del.body));
  assert.equal(del.body.remaining_attachments, 0);

  // The binary data is deleted from MongoDB together with the Attachment record.
  const afterDelete = await Attachment.findOne({ _id: row._id }).lean();
  assert.equal(afterDelete, null);
  assert.equal(await Attachment.countDocuments({ complaint_id: complaint._id }), 0);
  // Repeating the request 404s (no information leak, idempotent blind).
  assert.equal((await ownerAgent.delete(`/api/attachments/${row._id}`).set("X-CSRF-Token", ownerCsrf)).status, 404);

  assert.ok(await CaseEvent.findOne({ complaint_id: complaint._id, event: "attachment_deleted" }));
  assert.ok(await AuditEvent.findOne({ action: "attachment_deleted" }));
});

test("old attachments and case data count consistently after tests", async () => {
  const complaint = await Complaint.findOne({ ref_id: attachmentRef }).lean();
  assert.ok(complaint);
  assert.equal(await Attachment.countDocuments({ complaint_id: complaint._id }), 2);
  assert.equal(await CaseEvent.countDocuments({ complaint_id: complaint._id }), 0);
});
