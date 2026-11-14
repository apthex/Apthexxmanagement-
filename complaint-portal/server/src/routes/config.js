import express from "express";
import { captchaPublicConfig } from "../services/captcha.js";
import { env, isProduction } from "../config/env.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    environment: isProduction ? "production" : env.NODE_ENV,
    languages: ["en", "hi", "mr"],
    mainSiteUrl: env.MAIN_SITE_URL,
    captcha: captchaPublicConfig(),
    retentionNotice: "Completed case data is deleted after the approved retention period.",
    emergency: {
      police: "112",
      cybercrimeHelpline: "1930",
    },
  });
});

export default router;
