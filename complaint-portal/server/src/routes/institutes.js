import express from "express";
import Institute from "../models/Institute.js";
import { requireAuth, requireCsrf, requireRole } from "../middleware/auth.js";
import { audit } from "../utils/audit.js";
import { checkRateLimit } from "../utils/rateLimit.js";
import { hashIp } from "../utils/hash.js";
import { env } from "../config/env.js";
import { instituteCodeSchema, instituteCreateSchema } from "../utils/validation.js";

const router = express.Router();

function fieldsFrom(error) {
  const fields = {};
  for (const issue of error.issues) fields[issue.path.join(".") || "form"] = issue.message;
  return fields;
}

// Owner adds a college/institute: name + contact person + contact email.
// Code is generated automatically so the panel never has to invent one.
router.post("/", requireAuth, requireCsrf, requireRole("owner"), async (req, res, next) => {
  try {
    const parsed = instituteCreateSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Please check the institute details", fields: fieldsFrom(parsed.error) });
    const { name, head_name, head_email, type } = parsed.data;

    const base = (name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "APX").padEnd(3, "X");
    let institute = null;
    for (let attempt = 0; attempt < 12 && !institute; attempt += 1) {
      const code = attempt === 0 ? base : `${base}${Math.floor(10 + Math.random() * 90)}`;
      try {
        institute = await Institute.create({ code, name, type, head_name, head_email, status: "active", created_at: new Date() });
      } catch (error) {
        if (error?.code !== 11000) throw error; // duplicate code → retry with a suffix
      }
    }
    if (!institute) return res.status(500).json({ error: "Could not allocate an institute code, please retry" });

    await audit({
      member_id: req.member._id,
      action: "institute_created",
      entity: "institute",
      entity_id: institute.code,
      ip: req.ip,
    });
    res.status(201).json({
      institute: { code: institute.code, name: institute.name, type: institute.type, head_name: institute.head_name, head_email: institute.head_email },
    });
  } catch (error) {
    next(error);
  }
});

// Public college list for the /complaint quick form dropdown (name only, no sensitive fields).
router.get("/list", async (req, res, next) => {
  try {
    const institutes = await Institute.find({ status: "active" })
      .select("code name type")
      .sort({ name: 1 })
      .lean();
    res.json({ institutes: institutes.map(({ code, name, type }) => ({ code, name, type })) });
  } catch (error) {
    next(error);
  }
});

router.get("/validate", async (req, res, next) => {
  try {
    const parsed = instituteCodeSchema.safeParse(req.query.code || "");
    if (!parsed.success) {
      return res.status(400).json({ error: "Enter a valid institute code" });
    }

    const ipHash = hashIp(req.ip);
    const limit = await checkRateLimit(
      `institute:${ipHash}`,
      60 * 1000,
      env.RATE_LIMIT_INSTITUTE_PER_MINUTE
    );
    if (!limit.allowed) {
      res.set("Retry-After", String(limit.retryAfterSeconds));
      return res.status(429).json({ error: "Too many institute lookups. Please wait a minute and try again." });
    }

    const institute = await Institute.findOne({ code: parsed.data, status: "active" })
      .select("code name type")
      .lean();
    if (!institute) {
      return res.status(404).json({ error: "Institute code not recognised" });
    }
    res.json({ code: institute.code, name: institute.name, type: institute.type });
  } catch (error) {
    next(error);
  }
});

export default router;
