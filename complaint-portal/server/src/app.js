import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { env, isProduction, isTest, allowedOrigins } from "./config/env.js";
import authRoutes from "./routes/auth.js";
import instituteRoutes from "./routes/institutes.js";
import complaintRoutes from "./routes/complaints.js";
import statusRoutes from "./routes/status.js";
import attachmentRoutes from "./routes/attachments.js";
import staffRoutes from "./routes/staff.js";
import statsRoutes from "./routes/stats.js";
import reportRoutes from "./routes/reports.js";
import configRoutes from "./routes/config.js";
import captchaRoutes from "./routes/captcha.js";
import collectorRoutes from "./routes/collector.js";
import livewebRoutes from "./routes/liveweb.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY);

app.use(
  helmet({
    // The API only returns JSON and private files; the Next.js frontend sets
    // its own document CSP in next.config.mjs.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "no-referrer" },
    hsts: isProduction ? { maxAge: 15552000, includeSubDomains: true, preload: true } : false,
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      return callback(null, allowedOrigins().includes(origin.replace(/\/$/, "")));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());

if (!isTest) {
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      limit: 600,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Too many requests. Please slow down." },
    })
  );
}

app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    time: new Date().toISOString(),
  });
});

app.use("/api/config", configRoutes);
app.use("/api/captcha", captchaRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/institutes", instituteRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/status", statusRoutes);
app.use("/api/attachments", attachmentRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/c", collectorRoutes);
app.use("/api/liveweb", livewebRoutes);

app.use("/api", notFoundHandler);
app.use(errorHandler);

export default app;
