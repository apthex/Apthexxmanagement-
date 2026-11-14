import { z } from "zod";
import { CATEGORIES } from "../models/Complaint.js";
import { REF_ID_PATTERN } from "./refId.js";

export const PUBLIC_CATEGORIES = [
  "Blackmail and Sextortion",
  "Online Harassment or Bullying",
  "Financial Fraud or Threats",
  "Fake Profiles or Account Hacking",
  "Institution-level Issue",
];

export const URGENT_CATEGORY = "Urgent safety concern";

const categoryValues = [...CATEGORIES];
if (!categoryValues.includes(URGENT_CATEGORY)) categoryValues.push(URGENT_CATEGORY);

export const instituteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,32}$/, "Institute code must be 3-32 letters, numbers, hyphens or underscores");

export const refIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(REF_ID_PATTERN, "Enter a valid reference ID");

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+]?[\d\s-]{7,20}$/, "Enter a valid mobile number")
  .transform((value) => value.replace(/[^\d+]/g, ""));

const contactSchema = z.object({
  name: z.string().trim().min(2, "Full name is required").max(100),
  class_label: z.string().trim().min(1, "Class / course / division is required").max(100),
  roll_no: z.string().trim().max(50).optional().default(""),
  mobile: phoneSchema,
  email: emailSchema,
});

const booleanish = z
  .union([z.boolean(), z.enum(["true", "false"]), z.literal(0), z.literal(1)])
  .transform((v) => v === true || v === "true" || v === 1);

export const submissionSchema = z
  .object({
    institute_code: instituteCodeSchema,
    category: z.string().trim().max(100).optional(),
    details_text: z.string().min(10, "Please describe the complaint in at least 10 characters").max(5000),
    urgent: booleanish.optional().default(false),
    mode: z.enum(["identified", "anonymous"]).default("identified"),
    captchaToken: z.string().max(5000).optional(),
    captchaAnswer: z.string().max(10).optional(),
    deviceId: z.string().max(200).optional(),
    contact: contactSchema.optional(),
    // Flat fields are accepted from multipart form data.
    name: z.string().trim().max(100).optional(),
    class_label: z.string().trim().max(100).optional(),
    roll_no: z.string().trim().max(50).optional(),
    mobile: z.string().trim().max(30).optional(),
    email: z.string().trim().max(254).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.urgent) {
      if (data.category && data.category !== URGENT_CATEGORY) {
        ctx.addIssue({ code: "custom", path: ["category"], message: "Urgent submissions use the urgent workflow" });
      }
    } else if (!categoryValues.includes(data.category || "")) {
      ctx.addIssue({ code: "custom", path: ["category"], message: "Select a valid complaint category" });
    }

    if (data.mode === "anonymous") {
      const forbidden = ["name", "class_label", "roll_no", "mobile", "email"];
      for (const field of forbidden) {
        if (data[field] !== undefined && String(data[field]).trim() !== "") {
          ctx.addIssue({ code: "custom", path: [field], message: "Personal information is not accepted in anonymous mode" });
        }
      }
      if (data.contact) {
        ctx.addIssue({ code: "custom", path: ["contact"], message: "Personal information is not accepted in anonymous mode" });
      }
    } else {
      const contact = data.contact || {
        name: data.name,
        class_label: data.class_label,
        roll_no: data.roll_no || "",
        mobile: data.mobile,
        email: data.email,
      };
      const requiredFields = [
        ["name", "Full name is required"],
        ["class_label", "Class / course / division is required"],
        ["mobile", "Enter a valid mobile number"],
        ["email", "Enter a valid email address"],
      ];
      let missing = false;
      for (const [field, message] of requiredFields) {
        if (!contact[field] || String(contact[field]).trim() === "") {
          ctx.addIssue({ code: "custom", path: ["contact", field], message });
          missing = true;
        }
      }
      if (!missing) {
        const result = contactSchema.safeParse(contact);
        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({ code: "custom", path: ["contact", ...issue.path], message: issue.message });
          }
        }
      }
    }
  });

export const followupSchema = z.object({
  ref_id: refIdSchema,
  text: z.string().trim().min(5, "Please enter at least 5 characters").max(5000),
  captchaToken: z.string().max(5000).optional(),
  captchaAnswer: z.string().max(10).optional(),
  deviceId: z.string().max(200).optional(),
});

export const statusLookupSchema = z.object({
  ref_id: refIdSchema,
});

export const loginSchema = z.object({
  // Email is optional: password-only sign-in matches owners first, then case_team.
  email: emailSchema.optional(),
  password: z.string().min(1).max(256),
  code: z.string().trim().max(10).optional(),
});

export const setupSchema = z.object({
  email: emailSchema,
  setupToken: z.string().min(20).max(200),
  code: z.string().trim().min(6).max(10),
});

export const patchComplaintSchema = z
  .object({
    completed: z.boolean().optional(),
    flagged_spam: z.boolean().optional(),
    assigned_to: z.string().trim().regex(/^[a-f0-9]{24}$/i, "Invalid member").nullable().optional(),
    note: z.string().trim().min(1).max(5000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No changes supplied" });

export const memberCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  // Password optional: teachers get the standard default (teacher@123) when the
  // owner leaves it blank. Complex rules only apply to an explicitly set one.
  password: z
    .string()
    .trim()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[0-9]/, "Password must contain a number")
    .optional(),
  role: z.enum(["owner", "case_team"]).default("case_team"),
});

export const TEACHER_DEFAULT_PASSWORD = "Teacher8686@#";

export const instituteCreateSchema = z.object({
  name: z.string().trim().min(2, "Institute name is required").max(120),
  head_name: z.string().trim().min(2, "Contact person name is required").max(100),
  head_email: emailSchema,
  type: z.enum(["school", "college", "other"]).default("college"),
});

export const memberUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    role: z.enum(["owner", "case_team"]).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No changes supplied" });

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be YYYY-MM");

export const passwordResetSchema = z.object({
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(128)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});
