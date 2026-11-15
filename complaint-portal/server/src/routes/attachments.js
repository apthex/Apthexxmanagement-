import express from "express";
import Attachment from "../models/Attachment.js";
import Complaint from "../models/Complaint.js";
import CaseEvent from "../models/CaseEvent.js";
import { loadMemberFromSession, requireAuth, requireCsrf, requireRole } from "../middleware/auth.js";
import { readObject, deleteObject, signAttachmentUrl, verifyLocalSignature, storageDriver } from "../services/storage.js";
import { audit } from "../utils/audit.js";
import { sanitizeText } from "../utils/sanitize.js";

const router = express.Router();

router.get("/:id/url", requireAuth, requireRole("owner"), async (req, res, next) => {
  try {
    const attachment = await Attachment.findById(req.params.id).lean();
    if (!attachment) return res.status(404).json({ error: "Not found" });
    const complaint = await Complaint.exists({ _id: attachment.complaint_id });
    if (!complaint) return res.status(404).json({ error: "Not found" });

    const signed = await signAttachmentUrl(attachment);
    await audit({
      member_id: req.member._id,
      action: "attachment_url_issued",
      entity: "attachment",
      entity_id: String(attachment._id),
      detail: `complaint=${attachment.complaint_id}; type=${attachment.type}`,
      ip: req.ip,
    });
    res.set("Cache-Control", "no-store");
    res.json({ ...signed, mime: attachment.mime, type: attachment.type });
  } catch (error) {
    next(error);
  }
});

// Short-lived download endpoint for local and Vercel Blob private storage.
// The Vercel Blob token never leaves the server; clients fetch through this
// session-protected route. Vercel Blob private URLs are never returned
// directly to clients; downloads always route through this endpoint.
router.get("/download/:id", async (req, res, next) => {
  try {
    if (storageDriver === "vercel-blob") {
      const loaded = await loadMemberFromSession(req);
      if (!loaded) return res.status(401).json({ error: "Authentication required" });
      if (!["owner", "case_team"].includes(loaded.member.role)) {
        return res.status(404).json({ error: "Not found" });
      }
      const attachment = await Attachment.findById(req.params.id).lean();
      if (!attachment) return res.status(404).json({ error: "Not found" });
      const complaint = await Complaint.exists({ _id: attachment.complaint_id });
      if (!complaint) return res.status(404).json({ error: "Not found" });

      const buffer = await readObject(attachment.storage_key);
      await audit({
        member_id: loaded.member._id,
        action: "attachment_download",
        entity: "attachment",
        entity_id: String(attachment._id),
        detail: `complaint=${attachment.complaint_id}; type=${attachment.type}; via=vercel`,
        ip: req.ip,
      });
      res.set("Content-Type", attachment.mime);
      res.set("Content-Disposition", "inline");
      res.set("X-Content-Type-Options", "nosniff");
      res.set("Cache-Control", "private, no-store");
      res.set("Content-Security-Policy", "default-src 'none'; sandbox");
      res.send(buffer);
      return;
    }
    if (storageDriver !== "local") return res.status(404).json({ error: "Not found" });
    const { expires, signature } = req.query;
    if (!verifyLocalSignature(req.params.id, expires, signature)) {
      return res.status(404).json({ error: "Not found" });
    }
    const attachment = await Attachment.findById(req.params.id).lean();
    if (!attachment) return res.status(404).json({ error: "Not found" });
    const complaint = await Complaint.exists({ _id: attachment.complaint_id });
    if (!complaint) return res.status(404).json({ error: "Not found" });

    const buffer = await readObject(attachment.storage_key);
    await audit({
      action: "attachment_download",
      entity: "attachment",
      entity_id: String(attachment._id),
      detail: `complaint=${attachment.complaint_id}; type=${attachment.type}; via=signed_url`,
      ip: req.ip,
    });
    res.set("Content-Type", attachment.mime);
    res.set("Content-Disposition", "inline");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cache-Control", "private, no-store");
    res.set("Content-Security-Policy", "default-src 'none'; sandbox");
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

// Owner / case_team removal of a single evidence attachment. The private
// object is deleted from Vercel Blob first (idempotent), so a failed write
// never removes the record without the blob being gone. The change is
// recorded as a case event and an audit event.
router.delete("/:id", requireAuth, requireCsrf, requireRole("owner", "case_team"), async (req, res, next) => {
  try {
    const attachment = await Attachment.findById(req.params.id).lean();
    if (!attachment) return res.status(404).json({ error: "Not found" });
    const complaintExists = await Complaint.exists({ _id: attachment.complaint_id });
    if (!complaintExists) return res.status(404).json({ error: "Not found" });

    await deleteObject(attachment.storage_key);
    const removed = await Attachment.deleteOne({ _id: attachment._id });
    await CaseEvent.create({
      complaint_id: attachment.complaint_id,
      member_id: req.member._id,
      event: "attachment_deleted",
      note: sanitizeText(`${attachment.type}:${attachment.storage_key}`, 5000),
    });
    await audit({
      member_id: req.member._id,
      action: "attachment_deleted",
      entity: "attachment",
      entity_id: String(attachment._id),
      detail: `complaint=${attachment.complaint_id}; type=${attachment.type}; key=${attachment.storage_key}`,
      ip: req.ip,
    });
    const remaining = await Attachment.countDocuments({ complaint_id: attachment.complaint_id });
    res.json({ ok: true, removed: removed.deletedCount, remaining_attachments: remaining });
  } catch (error) {
    next(error);
  }
});

export default router;
