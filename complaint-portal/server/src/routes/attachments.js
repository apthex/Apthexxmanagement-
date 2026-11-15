import express from "express";
import Attachment from "../models/Attachment.js";
import Complaint from "../models/Complaint.js";
import CaseEvent from "../models/CaseEvent.js";
import { loadMemberFromSession, requireAuth, requireCsrf, requireRole } from "../middleware/auth.js";
import { audit } from "../utils/audit.js";
import { sanitizeText } from "../utils/sanitize.js";

const router = express.Router();

// Staff requests a download link for an attachment.
// Returns a server-proxied path; the actual binary is served through /download/:id
// and never exposes a raw storage URL to the client.
router.get("/:id/url", requireAuth, requireRole("owner"), async (req, res, next) => {
  try {
    const attachment = await Attachment.findById(req.params.id).lean();
    if (!attachment) return res.status(404).json({ error: "Not found" });
    const complaint = await Complaint.exists({ _id: attachment.complaint_id });
    if (!complaint) return res.status(404).json({ error: "Not found" });

    await audit({
      member_id: req.member._id,
      action: "attachment_url_issued",
      entity: "attachment",
      entity_id: String(attachment._id),
      detail: `complaint=${attachment.complaint_id}; type=${attachment.type}`,
      ip: req.ip,
    });
    res.set("Cache-Control", "no-store");
    res.json({
      url: `/api/attachments/download/${attachment._id}`,
      mime: attachment.mime,
      type: attachment.type,
      expires_at: new Date(Date.now() + 300 * 1000).toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Download endpoint — serves the attachment binary directly from MongoDB.
// Requires an authenticated staff session with owner or case_team role.
router.get("/download/:id", requireAuth, requireRole("owner", "case_team"), async (req, res, next) => {
  try {
    const attachment = await Attachment.findById(req.params.id).lean();
    if (!attachment) return res.status(404).json({ error: "Not found" });
    const complaint = await Complaint.exists({ _id: attachment.complaint_id });
    if (!complaint) return res.status(404).json({ error: "Not found" });

    await audit({
      member_id: req.member._id,
      action: "attachment_download",
      entity: "attachment",
      entity_id: String(attachment._id),
      detail: `complaint=${attachment.complaint_id}; type=${attachment.type}; via=mongodb`,
      ip: req.ip,
    });
    res.set("Content-Type", attachment.mime);
    res.set("Content-Disposition", "inline");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cache-Control", "private, no-store");
    res.set("Content-Security-Policy", "default-src 'none'; sandbox");
    res.send(attachment.data);
  } catch (error) {
    next(error);
  }
});

// Owner / case_team removal of a single evidence attachment.
// The binary data is stored in MongoDB and deleted together with the Attachment record.
router.delete("/:id", requireAuth, requireCsrf, requireRole("owner", "case_team"), async (req, res, next) => {
  try {
    const attachment = await Attachment.findById(req.params.id).lean();
    if (!attachment) return res.status(404).json({ error: "Not found" });
    const complaintExists = await Complaint.exists({ _id: attachment.complaint_id });
    if (!complaintExists) return res.status(404).json({ error: "Not found" });

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
