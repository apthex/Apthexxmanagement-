import express from "express";
import { newLocalChallenge, captchaPublicConfig } from "../services/captcha.js";
import { checkRateLimit } from "../utils/rateLimit.js";
import { hashIp } from "../utils/hash.js";
import { env } from "../config/env.js";

const router = express.Router();

// Signed arithmetic challenge for the zero-setup local CAPTCHA. Turnstile mode
// never calls this — the widget issues its own token instead.
router.get("/", async (req, res, next) => {
  try {
    if (captchaPublicConfig().mode !== "local") {
      return res.status(404).json({ error: "Not found" });
    }
    const limit = await checkRateLimit(`captcha:${hashIp(req.ip)}`, 60 * 1000, env.RATE_LIMIT_INSTITUTE_PER_MINUTE || 30);
    if (!limit.allowed) return res.status(429).json({ error: "Too many requests, try again shortly" });
    res.set("Cache-Control", "no-store");
    res.json(newLocalChallenge());
  } catch (error) {
    next(error);
  }
});

export default router;
