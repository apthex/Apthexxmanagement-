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

// Every institute ref ID follows the APT-### format (e.g. APT-101, APT-KWW).
// Codes use the APT- prefix, custom-chosen or randomly allocated.
const CODE_PREFIX = "APT-";
// 3-digit pool first (APT-100 … APT-999); the wider 4-digit pool only
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

// Normalizes an institute code ensuring the APT- prefix and uppercase formatting.
function normalizeInstituteCode(input) {
  if (!input) return "";
  let trimmed = input.trim().toUpperCase();
  if (!trimmed.startsWith(CODE_PREFIX)) {
    trimmed = `${CODE_PREFIX}${trimmed.replace(/^APT-?/i, "")}`;
  }
  return trimmed;
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

// Owner checks if a custom code already exists before generating.
router.get("/check-code", requireAuth, requireRole("owner"), async (req, res, next) => {
  try {
    const raw = (req.query.code || "").trim();
    if (!raw) return res.status(400).json({ error: "Code is required to check availability" });

    const code = normalizeInstituteCode(raw);
    const existing = await Institute.findOne({ code }).select("code name status").lean();
    if (existing) {
      return res.json({
        exists: true,
        code: existing.code,
        name: existing.name || "",
        status: existing.status,
        message: `Code '${existing.code}' already exists${existing.name ? ` for "${existing.name}"` : ""}.`,
      });
    }

    return res.json({
      exists: false,
      code,
      message: `Code '${code}' is available.`,
    });
  } catch (error) {
    next(error);
  }
});

// Owner generates a new institute ref ID. Supports custom APT- code with duplicate verification,
// or auto-allocates an APT-### code.
router.post("/", requireAuth, requireCsrf, requireRole("owner"), async (req, res, next) => {
  try {
    const parsed = instituteGenerateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Please check the institute details", fields: fieldsFrom(parsed.error) });
    }
    const { name, head_name, head_email, type, code: customCode } = parsed.data;

    let targetCode = "";
    if (customCode && customCode.trim()) {
      targetCode = normalizeInstituteCode(customCode);
      if (!/^APT-[A-Z0-9_-]{1,30}$/.test(targetCode)) {
        return res.status(400).json({
          error: "Invalid institute code format. Code must start with APT- and contain letters, numbers, hyphens or underscores (e.g. APT-101 or APT-KWW).",
          fields: { code: "Invalid format. E.g. APT-101" },
        });
      }

      // Check if code already exists in database
      const existing = await Institute.findOne({ code: targetCode });
      if (existing) {
        return res.status(409).json({
          error: `Institute code '${targetCode}' already exists for "${existing.name || "another college"}". Please choose a different code.`,
          fields: { code: `Code '${targetCode}' already exists` },
        });
      }
    } else {
      targetCode = await allocateCode();
    }

    if (!targetCode) {
      return res.status(500).json({ error: "Could not allocate an institute code, please retry" });
    }

    let institute = null;
    try {
      institute = await Institute.create({
        code: targetCode,
        name: name || "",
        type,
        head_name: name ? head_name : "",
        head_email: name ? head_email : "",
        status: "active",
        created_at: new Date(),
        updated_at: new Date(),
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          error: `Institute code '${targetCode}' already exists. Please choose a different code.`,
          fields: { code: "Code already exists" },
        });
      }
      throw error;
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
    const requestedCode = (req.body?.new_code || "").trim();
    let newCode = "";

    if (requestedCode) {
      newCode = normalizeInstituteCode(requestedCode);
      if (!/^APT-[A-Z0-9_-]{1,30}$/.test(newCode)) {
        return res.status(400).json({ error: "Invalid code format. Must start with APT- (e.g. APT-102)" });
      }
      if (newCode === previousCode) {
        return res.status(400).json({ error: "New code must be different from current code" });
      }
      const existing = await Institute.findOne({ code: newCode });
      if (existing) {
        return res.status(409).json({ error: `Institute code '${newCode}' already exists for "${existing.name || "another college"}". Please choose a different code.` });
      }
    } else {
      newCode = await allocateCode();
    }

    if (!newCode) return res.status(500).json({ error: "Could not allocate a new code, please retry" });

    let updated = null;
    try {
      updated = await Institute.findOneAndUpdate(
        { code: previousCode },
        { $set: { code: newCode, updated_at: new Date() } },
        { returnDocument: "after" }
      );
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ error: `Code '${newCode}' is already taken.` });
      }
      throw error;
    }

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
