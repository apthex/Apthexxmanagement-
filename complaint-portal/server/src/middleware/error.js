import { ZodError } from "zod";
import multer from "multer";
import { isProduction } from "../config/env.js";

export function notFoundHandler(req, res) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "form";
      fields[key] = issue.message;
    }
    return res.status(400).json({ error: "Please check the highlighted fields", fields });
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "One of the files is too large"
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
          ? "Too many files or an unexpected file field"
          : "File upload could not be processed";
    return res.status(400).json({ error: message });
  }

  if (err?.code === 11000) {
    return res.status(409).json({ error: "A duplicate record already exists" });
  }

  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON request body" });
  }

  const status = Number(err.status) >= 400 && Number(err.status) < 600 ? Number(err.status) : 500;
  if (status >= 500) console.error("[error]", err);
  const message = status >= 500 ? "Internal server error" : err.message || "Request failed";
  res.status(status).json({ error: message });
}
