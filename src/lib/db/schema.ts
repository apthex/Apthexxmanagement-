import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* ---------------------------------------------------------------------------
 * Enums
 * ------------------------------------------------------------------------- */

export const accessLevelEnum = pgEnum("access_level", ["owner", "team", "growth", "viewer"]);
export const memberStatusEnum = pgEnum("member_status", ["active", "inactive"]);
export const leadStageEnum = pgEnum("lead_stage", ["identified", "talking", "pitched", "won", "lost"]);
export const serviceTypeEnum = pgEnum("service_type", ["awareness", "vapt", "other"]);
export const agreementStatusEnum = pgEnum("agreement_status", ["none", "draft", "sent", "signed", "expired"]);
export const clientStatusEnum = pgEnum("client_status", ["active", "on_hold", "closed"]);
export const taskStatusEnum = pgEnum("task_status", ["todo", "in_progress", "blocked", "done"]);
export const financeDirectionEnum = pgEnum("finance_direction", ["in", "out"]);
export const financeCategoryEnum = pgEnum("finance_category", [
  "services",
  "tools",
  "payroll",
  "infrastructure",
  "travel",
  "other",
]);
export const auditOutcomeEnum = pgEnum("audit_outcome", ["allowed", "denied"]);
export const setupPurposeEnum = pgEnum("setup_purpose", ["invite", "reset"]);

/* ---------------------------------------------------------------------------
 * Shared columns
 * ------------------------------------------------------------------------- */

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const deletedAt = timestamp("deleted_at", { withTimezone: true });

/* ---------------------------------------------------------------------------
 * 1. members
 * ------------------------------------------------------------------------- */

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    roleTitle: text("role_title").notNull().default(""),
    accessLevel: accessLevelEnum("access_level").notNull(),
    joinedOn: date("joined_on").notNull(),
    status: memberStatusEnum("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdBy: uuid("created_by").references((): AnyPgColumn => members.id, { onDelete: "restrict" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [
    uniqueIndex("members_email_unique").on(sql`lower(${t.email})`),
    index("members_access_level_idx").on(t.accessLevel),
    index("members_status_idx").on(t.status),
  ],
);

/* ---------------------------------------------------------------------------
 * 2. credentials
 * ------------------------------------------------------------------------- */

export const credentials = pgTable(
  "credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    passwordHash: text("password_hash").notNull(),
    totpSecret: text("totp_secret"),
    totpEnrolledAt: timestamp("totp_enrolled_at", { withTimezone: true }),
    recoveryCodeHashes: text("recovery_code_hashes").array().notNull().default(sql`'{}'::text[]`),
    recoveryCodesUsed: integer("recovery_codes_used").notNull().default(0),
    setupTokenHash: text("setup_token_hash"),
    setupExpiresAt: timestamp("setup_expires_at", { withTimezone: true }),
    setupPurpose: setupPurposeEnum("setup_purpose"),
    lastTotpStep: bigint("last_totp_step", { mode: "number" }),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => members.id, { onDelete: "restrict" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [
    uniqueIndex("credentials_member_unique").on(t.memberId),
    index("credentials_setup_token_idx").on(t.setupTokenHash),
  ],
);

/* ---------------------------------------------------------------------------
 * 3. sessions
 * ------------------------------------------------------------------------- */

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    tokenHash: text("token_hash").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdBy: uuid("created_by").references(() => members.id, { onDelete: "restrict" }),
    createdAt,
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_unique").on(t.tokenHash),
    index("sessions_member_idx").on(t.memberId),
    index("sessions_expiry_idx").on(t.expiresAt),
  ],
);

/* ---------------------------------------------------------------------------
 * 4. leads
 * ------------------------------------------------------------------------- */

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    company: text("company").notNull(),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    source: text("source"),
    stage: leadStageEnum("stage").notNull().default("identified"),
    ownerMemberId: uuid("owner_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    valueEstimatePaise: bigint("value_estimate_paise", { mode: "number" }),
    nextAction: text("next_action"),
    nextActionOn: date("next_action_on"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => members.id, { onDelete: "restrict" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [
    index("leads_stage_idx").on(t.stage),
    index("leads_owner_idx").on(t.ownerMemberId),
    index("leads_next_action_idx").on(t.nextActionOn),
  ],
);

/* ---------------------------------------------------------------------------
 * 5. lead_events (append-only)
 * ------------------------------------------------------------------------- */

export const leadEvents = pgTable(
  "lead_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    fromStage: leadStageEnum("from_stage"),
    toStage: leadStageEnum("to_stage"),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lead_events_lead_idx").on(t.leadId, t.occurredAt)],
);

/* ---------------------------------------------------------------------------
 * 6. clients
 * ------------------------------------------------------------------------- */

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "restrict" }),
    company: text("company").notNull(),
    ownerMemberId: uuid("owner_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    serviceType: serviceTypeEnum("service_type").notNull(),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    scopeOfWork: text("scope_of_work"),
    agreementStatus: agreementStatusEnum("agreement_status").notNull().default("none"),
    agreementRef: text("agreement_ref"),
    agreementSignedOn: date("agreement_signed_on"),
    status: clientStatusEnum("status").notNull().default("active"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => members.id, { onDelete: "restrict" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [
    index("clients_owner_idx").on(t.ownerMemberId),
    index("clients_status_idx").on(t.status),
    uniqueIndex("clients_lead_unique").on(t.leadId).where(sql`${t.leadId} is not null and ${t.deletedAt} is null`),
  ],
);

/* ---------------------------------------------------------------------------
 * 7. client_assignments
 * ------------------------------------------------------------------------- */

export const clientAssignments = pgTable(
  "client_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    assignedBy: uuid("assigned_by")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => members.id, { onDelete: "restrict" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [
    uniqueIndex("client_assignments_active_unique")
      .on(t.clientId, t.memberId)
      .where(sql`${t.removedAt} is null and ${t.deletedAt} is null`),
    index("client_assignments_member_idx").on(t.memberId),
  ],
);

/* ---------------------------------------------------------------------------
 * 8. tasks
 * ------------------------------------------------------------------------- */

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    assigneeMemberId: uuid("assignee_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "restrict" }),
    dueOn: date("due_on"),
    status: taskStatusEnum("status").notNull().default("todo"),
    meetingId: uuid("meeting_id"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => members.id, { onDelete: "restrict" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [
    index("tasks_assignee_idx").on(t.assigneeMemberId),
    index("tasks_status_idx").on(t.status),
    index("tasks_due_idx").on(t.dueOn),
    index("tasks_client_idx").on(t.clientId),
  ],
);

/* ---------------------------------------------------------------------------
 * 9. task_comments
 * ------------------------------------------------------------------------- */

export const taskComments = pgTable(
  "task_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdBy: uuid("created_by").references(() => members.id, { onDelete: "restrict" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [index("task_comments_task_idx").on(t.taskId, t.createdAt)],
);

/* ---------------------------------------------------------------------------
 * 10. work_logs
 * ------------------------------------------------------------------------- */

export const workLogs = pgTable(
  "work_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    logDate: date("log_date").notNull(),
    summary: text("summary").notNull(),
    hours: numeric("hours", { precision: 4, scale: 2 }).notNull(),
    taskIds: uuid("task_ids").array().notNull().default(sql`'{}'::uuid[]`),
    rating: integer("rating"),
    ratedBy: uuid("rated_by").references(() => members.id, { onDelete: "restrict" }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => members.id, { onDelete: "restrict" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [
    uniqueIndex("work_logs_member_day_unique")
      .on(t.memberId, t.logDate)
      .where(sql`${t.deletedAt} is null`),
    index("work_logs_date_idx").on(t.logDate),
    check("work_logs_hours_check", sql`${t.hours} >= 0 and ${t.hours} <= 24`),
    check("work_logs_rating_check", sql`${t.rating} is null or (${t.rating} >= 1 and ${t.rating} <= 5)`),
  ],
);

/* ---------------------------------------------------------------------------
 * 11. meetings
 * ------------------------------------------------------------------------- */

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    heldOn: date("held_on").notNull(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "restrict" }),
    attendeeMemberIds: uuid("attendee_member_ids").array().notNull().default(sql`'{}'::uuid[]`),
    externalAttendees: text("external_attendees"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => members.id, { onDelete: "restrict" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [index("meetings_held_on_idx").on(t.heldOn), index("meetings_client_idx").on(t.clientId)],
);

/* ---------------------------------------------------------------------------
 * 12. finance_entries
 * ------------------------------------------------------------------------- */

export const financeEntries = pgTable(
  "finance_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryDate: date("entry_date").notNull(),
    direction: financeDirectionEnum("direction").notNull(),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    description: text("description").notNull(),
    category: financeCategoryEnum("category").notNull(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "restrict" }),
    reversesEntryId: uuid("reverses_entry_id").references((): AnyPgColumn => financeEntries.id, {
      onDelete: "restrict",
    }),
    createdBy: uuid("created_by").references(() => members.id, { onDelete: "restrict" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [
    index("finance_entries_date_idx").on(t.entryDate),
    index("finance_entries_client_idx").on(t.clientId),
    check("finance_entries_amount_check", sql`${t.amountPaise} > 0`),
  ],
);

/* ---------------------------------------------------------------------------
 * 13. rate_limits
 *
 * Fixed-window, database-backed limiter. In-memory counters do not survive
 * serverless instances, so counters live here.
 * ------------------------------------------------------------------------- */

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index("rate_limits_created_idx").on(t.createdAt)],
);

/* ---------------------------------------------------------------------------
 * 14. audit_events (append-only, no updated_at / deleted_at)
 * ------------------------------------------------------------------------- */

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    outcome: auditOutcomeEnum("outcome").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    detail: jsonb("detail").notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [
    index("audit_events_occurred_idx").on(t.occurredAt),
    index("audit_events_member_idx").on(t.memberId, t.occurredAt),
    index("audit_events_action_idx").on(t.action, t.occurredAt),
    index("audit_events_outcome_idx").on(t.outcome, t.occurredAt),
  ],
);

/* ---------------------------------------------------------------------------
 * Convenience types
 * ------------------------------------------------------------------------- */

export type Member = typeof members.$inferSelect;
export type Credential = typeof credentials.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type WorkLog = typeof workLogs.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type FinanceEntry = typeof financeEntries.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type AccessLevel = (typeof accessLevelEnum.enumValues)[number];
export type AuditOutcome = (typeof auditOutcomeEnum.enumValues)[number];
