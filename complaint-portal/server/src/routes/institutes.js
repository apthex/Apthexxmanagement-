import express from "express";
import Institute from "../models/Institute.js";
import { requireAuth, requireCsrf, requireRole } from "../middleware/auth.js";
import { audit } from "../utils/audit.js";
import { checkRateLimit } from "../utils/rateLimit.js";
import { hashIp } from "../utils/hash.js";
import { env } from "../config/env.js";
import {
  instituteCodeSchema,
  instituteGenerateSchema,
  instituteUpdateSchema,
} from "../utils/validation.js";

const router = express.Router();

// Every institute ref ID follows the APXJIT-### format, e.g. APXJIT-234.
// Numbers are random instead of sequential so an ID reveals nothing about the
// order colleges were added in, and every college keeps its own distinct ID.
const CODE_PREFIX = "APXJIT-";
// 3-digit pool first (APXJIT-100 … APXJIT-999); the wider 4-digit pool only
// kicks in if the small pool is ever exhausted.
const CODE_RANGES = [
  [100, 999],
  [1000, 9999],
];
const ATTEMPTS_PER_RANGE = 25;

function fieldsFrom(error) {
  const fields = {};
  for (const issue of error.issues) fields[issue.path.join(".") || "form"] = issue.message;
  return fields;
}

// Picks a random unused number inside the range. `Institute.exists` keeps the
// odds of a duplicate tiny; the unique index on `code` catches the remaining
// races and the caller simply retries.
async function allocateCode() {
  for (const [min, max] of CODE_RANGES) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_RANGE; attempt += 1) {
      const number = min + Math.floor(Math.random() * (max - min + 1));
      const code = `${CODE_PREFIX}${number}`;
      const taken = await Institute.exists({ code });
      if (!taken) return code;
    }
  }
  return null;
}

function instituteView(institute) {
  return {
    code: institute.code,
    name: institute.name || "",
    type: institute.type,
    head_name: institute.head_name || "",
    head_email: institute.head_email || "",
    status: institute.status,
    created_at: institute.created_at,
    assigned: Boolean(institute.name && institute.name.trim()),
  };
}

// Owner generates a new institute ref ID. With college details it is created
// assigned; without them it is an unassigned code the panel can attach later.
router.post("/", requireAuth, requireCsrf, requireRole("owner"), async (req, res, next) => {
  try {
    const parsed = instituteGenerateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Please check the institute details", fields: fieldsFrom(parsed.error) });
    }
    const { name, head_name, head_email, type } = parsed.data;

    let institute = null;
    for (let attempt = 0; attempt < 5 && !institute; attempt += 1) {
      const code = await allocateCode();
      if (!code) break;
      try {
        institute = await Institute.create({
          code,
          name: name || "",
          type,
          head_name: name ? head_name : "",
          head_email: name ? head_email : "",
          status: "active",
          created_at: new Date(),
          updated_at: new Date(),
        });
      } catch (error) {
        if (error?.code !== 11000) throw error; // rare race → pick another random code
      }
    }
    if (!institute) {
      return res.status(500).json({ error: "Could not allocate an institute code, please retry" });
    }

    await audit({
      member_id: req.member._id,
      action: name ? "institute_created" : "institute_code_generated",
      entity: "institute",
      entity_id: institute.code,
      ip: req.ip,
    });
    res.status(201).json({ institute: instituteView(institute) });
  } catch (error) {
    next(error);
  }
});

// Public college list for student-facing pickers: only assigned, active codes.
router.get("/list", async (req, res, next) => {
  try {
    const institutes = await Institute.find({ status: "active", name: { $ne: "" } })
      .select("code name type")
      .sort({ name: 1 })
      .lean();
    res.json({ institutes: institutes.map(({ code, name, type }) => ({ code, name, type })) });
  } catch (error) {
    next(error);
  }
});

// Owner view: every ref ID and the college it is assigned to.
router.get("/all", requireAuth, requireRole("owner"), async (req, res, next) => {
  try {
    const institutes = await Institute.find({}).sort({ created_at: -1, code: 1 }).lean();
    res.json({ institutes: institutes.map(instituteView) });
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

    // Unassigned codes (generated but not attached to a college yet) must not
    // pass validation — students can only report against assigned institutes.
    const institute = await Institute.findOne({
      code: parsed.data,
      status: "active",
      name: { $ne: "" },
    })
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

// Owner updates an institute: attach a college to an unassigned code, edit the
// contact details, or activate/deactivate the code.
router.patch("/:code", requireAuth, requireCsrf, requireRole("owner"), async (req, res, next) => {
  try {
    const parsedCode = instituteCodeSchema.safeParse(req.params.code || "");
    if (!parsedCode.success) return res.status(404).json({ error: "Not found" });
    const parsed = instituteUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Please check the institute details", fields: fieldsFrom(parsed.error) });
    }

    const institute = await Institute.findOneAndUpdate(
      { code: parsedCode.data },
      { $set: { ...parsed.data, updated_at: new Date() } },
      { returnDocument: "after" }
    );
    if (!institute) return res.status(404).json({ error: "Institute code not recognised" });

    await audit({
      member_id: req.member._id,
      action: "institute_updated",
      entity: "institute",
      entity_id: institute.code,
      ip: req.ip,
    });
    res.json({ institute: instituteView(institute) });
  } catch (error) {
    next(error);
  }
});

// Owner issues a fresh ref ID for the same college. The old code stops
// validating immediately; the audit log keeps the old → new link.
router.post("/:code/regenerate", requireAuth, requireCsrf, requireRole("owner"), async (req, res, next) => {
  try {
    const parsedCode = instituteCodeSchema.safeParse(req.params.code || "");
    if (!parsedCode.success) return res.status(404).json({ error: "Not found" });

    const institute = await Institute.findOne({ code: parsedCode.data });
    if (!institute) return res.status(404).json({ error: "Institute code not recognised" });

    const previousCode = institute.code;
    let updated = null;
    for (let attempt = 0; attempt < 5 && !updated; attempt += 1) {
      const code = await allocateCode();
      if (!code) break;
      if (code === previousCode) continue; // cannot happen (previous is taken), kept as a guard
      try {
        updated = await Institute.findOneAndUpdate(
          { code: previousCode },
          { $set: { code, updated_at: new Date() } },
          { returnDocument: "after" }
        );
      } catch (error) {
        if (error?.code !== 11000) throw error; // rare race → pick another random code
      }
    }
    if (!updated) return res.status(500).json({ error: "Could not allocate a new code, please retry" });

    await audit({
      member_id: req.member._id,
      action: "institute_code_regenerated",
      entity: "institute",
      entity_id: updated.code,
      ip: req.ip,
      detail: `previous_code=${previousCode}`,
    });
    res.json({ institute: instituteView(updated), previous_code: previousCode });
  } catch (error) {
    next(error);
  }
});

export default router;
