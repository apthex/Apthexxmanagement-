import { z } from "zod";
import { isValidDateString } from "@/lib/dates";

const text = (max = 500) => z.string().trim().max(max);
const requiredText = (max = 500, min = 1) => z.string().trim().min(min).max(max);
const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value || null);
const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254)
  .nullable()
  .optional()
  .transform((value) => value || null);
const dateString = z.string().refine(isValidDateString, "Use a valid YYYY-MM-DD date");
const optionalDate = dateString
  .nullable()
  .optional()
  .transform((value) => value || null);
const uuid = z.string().uuid();
const optionalUuid = uuid
  .nullable()
  .optional()
  .transform((value) => value || null);
const paise = z.number().int().min(0).max(1_000_000_000_000);

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128),
    code: z.string().trim().max(32).optional().default(""),
  })
  .strict();

export const setupPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: z.string().min(1).max(128),
  })
  .strict();

export const setupConfirmSchema = z
  .object({
    token: z.string().min(20).max(200),
    code: z.string().trim().min(6).max(16),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
  })
  .strict();

export const leadCreateSchema = z
  .object({
    company: requiredText(200, 2),
    contactName: optionalText(200),
    contactEmail: optionalEmail,
    contactPhone: optionalText(50),
    source: optionalText(100),
    ownerMemberId: uuid,
    valueEstimatePaise: paise.nullable().optional().default(null),
    nextAction: optionalText(500),
    nextActionOn: optionalDate,
    notes: optionalText(4000),
  })
  .strict();

export const leadUpdateSchema = z
  .object({
    company: requiredText(200, 2).optional(),
    contactName: optionalText(200),
    contactEmail: optionalEmail,
    contactPhone: optionalText(50),
    source: optionalText(100),
    ownerMemberId: uuid.optional(),
    valueEstimatePaise: paise.nullable().optional(),
    nextAction: optionalText(500),
    nextActionOn: optionalDate,
    notes: optionalText(4000),
  })
  .strict();

export const leadStageSchema = z
  .object({
    stage: z.enum(["identified", "talking", "pitched", "won", "lost"]),
    note: optionalText(1000),
  })
  .strict();

export const leadDeleteSchema = z.object({ confirmName: requiredText(200, 1) }).strict();

export const leadConvertSchema = z
  .object({
    serviceType: z.enum(["awareness", "vapt", "other"]),
    ownerMemberId: uuid,
    scopeOfWork: optionalText(4000),
    agreementStatus: z.enum(["none", "draft", "sent", "signed", "expired"]).default("none"),
    agreementRef: optionalText(200),
    agreementSignedOn: optionalDate,
    notes: optionalText(4000),
  })
  .strict();

export const clientCreateSchema = z
  .object({
    company: requiredText(200, 2),
    ownerMemberId: uuid,
    serviceType: z.enum(["awareness", "vapt", "other"]),
    contactName: optionalText(200),
    contactEmail: optionalEmail,
    contactPhone: optionalText(50),
    scopeOfWork: optionalText(4000),
    agreementStatus: z.enum(["none", "draft", "sent", "signed", "expired"]).default("none"),
    agreementRef: optionalText(200),
    agreementSignedOn: optionalDate,
    status: z.enum(["active", "on_hold", "closed"]).default("active"),
    notes: optionalText(4000),
  })
  .strict();

export const clientUpdateSchema = z
  .object({
    company: requiredText(200, 2).optional(),
    ownerMemberId: uuid.optional(),
    serviceType: z.enum(["awareness", "vapt", "other"]).optional(),
    contactName: optionalText(200),
    contactEmail: optionalEmail,
    contactPhone: optionalText(50),
    scopeOfWork: optionalText(4000),
    agreementStatus: z.enum(["none", "draft", "sent", "signed", "expired"]).optional(),
    agreementRef: optionalText(200),
    agreementSignedOn: optionalDate,
    status: z.enum(["active", "on_hold", "closed"]).optional(),
    notes: optionalText(4000),
  })
  .strict();

export const assignmentSchema = z
  .object({
    memberId: uuid,
    note: optionalText(500),
  })
  .strict();

export const taskCreateSchema = z
  .object({
    title: requiredText(240, 2),
    description: optionalText(4000),
    assigneeMemberId: uuid,
    clientId: optionalUuid,
    dueOn: optionalDate,
    status: z.enum(["todo", "in_progress", "blocked", "done"]).default("todo"),
    meetingId: optionalUuid,
  })
  .strict();

export const taskUpdateSchema = z
  .object({
    title: requiredText(240, 2).optional(),
    description: optionalText(4000),
    assigneeMemberId: uuid.optional(),
    clientId: optionalUuid,
    dueOn: optionalDate,
    status: z.enum(["todo", "in_progress", "blocked", "done"]).optional(),
    meetingId: optionalUuid,
  })
  .strict();

export const taskCommentSchema = z.object({ body: requiredText(2000, 1) }).strict();

export const workLogCreateSchema = z
  .object({
    logDate: dateString,
    summary: requiredText(4000, 3),
    hours: z
      .string()
      .trim()
      .regex(/^\d{1,2}(\.\d{1,2})?$/, "Hours must be a number with up to two decimals")
      .refine((value) => Number(value) > 0 && Number(value) <= 24, "Hours must be between 0 and 24"),
    taskIds: z.array(uuid).max(50).default([]),
  })
  .strict();

export const workLogUpdateSchema = z
  .object({
    summary: requiredText(4000, 3).optional(),
    hours: z
      .string()
      .trim()
      .regex(/^\d{1,2}(\.\d{1,2})?$/, "Hours must be a number with up to two decimals")
      .refine((value) => Number(value) > 0 && Number(value) <= 24, "Hours must be between 0 and 24")
      .optional(),
    taskIds: z.array(uuid).max(50).optional(),
  })
  .strict();

export const workLogRateSchema = z
  .object({
    rating: z.number().int().min(1).max(5).nullable(),
  })
  .strict();

export const meetingCreateSchema = z
  .object({
    title: requiredText(240, 2),
    heldOn: dateString,
    clientId: optionalUuid,
    attendeeMemberIds: z.array(uuid).max(100).default([]),
    externalAttendees: optionalText(1000),
    notes: optionalText(10_000),
  })
  .strict();

export const meetingUpdateSchema = z
  .object({
    title: requiredText(240, 2).optional(),
    heldOn: dateString.optional(),
    clientId: optionalUuid,
    attendeeMemberIds: z.array(uuid).max(100).optional(),
    externalAttendees: optionalText(1000),
    notes: optionalText(10_000),
  })
  .strict();

export const financeCreateSchema = z
  .object({
    entryDate: dateString,
    direction: z.enum(["in", "out"]),
    amountPaise: z.number().int().positive().max(1_000_000_000_000),
    description: requiredText(500, 2),
    category: z.enum(["services", "tools", "payroll", "infrastructure", "travel", "other"]),
    clientId: optionalUuid,
  })
  .strict();

export const financeUpdateSchema = z
  .object({
    entryDate: dateString.optional(),
    amountPaise: z.number().int().positive().max(1_000_000_000_000).optional(),
    description: requiredText(500, 2).optional(),
    category: z.enum(["services", "tools", "payroll", "infrastructure", "travel", "other"]).optional(),
    clientId: optionalUuid,
  })
  .strict();

export const financeReverseSchema = z
  .object({
    confirmName: requiredText(500, 1),
    reason: requiredText(500, 3),
  })
  .strict();

export const memberCreateSchema = z
  .object({
    name: requiredText(120, 2),
    email: z.string().trim().toLowerCase().email().max(254),
    roleTitle: requiredText(120, 2),
    accessLevel: z.enum(["owner", "team", "growth", "viewer"]),
    joinedOn: dateString,
    status: z.enum(["active", "inactive"]).default("active"),
  })
  .strict();

export const memberUpdateSchema = z
  .object({
    name: requiredText(120, 2).optional(),
    email: z.string().trim().toLowerCase().email().max(254).optional(),
    roleTitle: requiredText(120, 2).optional(),
    accessLevel: z.enum(["owner", "team", "growth", "viewer"]).optional(),
    joinedOn: dateString.optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict();

export const deactivateMemberSchema = z
  .object({
    confirmName: requiredText(120, 1),
  })
  .strict();

export const resetTotpSchema = z
  .object({
    confirmName: requiredText(120, 1),
  })
  .strict();

export const auditQuerySchema = z
  .object({
    memberId: uuid.optional(),
    action: z.string().trim().max(100).optional(),
    outcome: z.enum(["allowed", "denied"]).optional(),
    from: dateString.optional(),
    to: dateString.optional(),
    q: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

export const pageQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

export const csvQuerySchema = z
  .object({
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
  })
  .strict();

export const workLogQuerySchema = z
  .object({
    week: dateString.optional(),
  })
  .strict();

export const taskQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    status: z.enum(["todo", "in_progress", "blocked", "done"]).optional(),
    assigneeMemberId: uuid.optional(),
    due: z.enum(["overdue", "today"]).optional(),
  })
  .strict();

export const financeQuerySchema = z
  .object({
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
    q: z.string().trim().max(200).optional(),
    direction: z.enum(["in", "out"]).optional(),
    category: z.enum(["services", "tools", "payroll", "infrastructure", "travel", "other"]).optional(),
  })
  .strict();

export const livewebQuerySchema = z
  .object({
    range: z.enum(["live", "today", "7d", "30d"]).default("7d"),
  })
  .strict();
