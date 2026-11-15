import Complaint from "../models/Complaint.js";
import Contact from "../models/Contact.js";
import Attachment from "../models/Attachment.js";
import CaseEvent from "../models/CaseEvent.js";
import DeletionLog from "../models/DeletionLog.js";
import { audit } from "../utils/audit.js";

let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 60 * 1000;

export async function purgeComplaint(complaint, { deletedBy = "system" } = {}) {
  const deleted = await Complaint.findOneAndDelete({ _id: complaint._id });
  if (!deleted) return false;

  // Attachment binary data lives in MongoDB, so deleting the documents removes the data too.
  await Promise.all([
    Attachment.deleteMany({ complaint_id: deleted._id }),
    Contact.deleteMany({ complaint_id: deleted._id }),
    CaseEvent.deleteMany({ complaint_id: deleted._id }),
  ]);
  await DeletionLog.create({
    ref_id: deleted.ref_id,
    institute_code: deleted.institute_code,
    deleted_by: deletedBy,
    reason: "retention_expired",
  });
  await audit({
    action: "retention_deletion",
    entity: "complaint",
    entity_id: deleted.ref_id,
    detail: `institute=${deleted.institute_code}; by=${deletedBy}`,
  });
  return true;
}

export async function purgeDueComplaints({ limit = 100, deletedBy = "scheduler" } = {}) {
  const due = await Complaint.find({ delete_after: { $lte: new Date() } })
    .select("_id ref_id institute_code delete_after")
    .limit(limit)
    .lean();
  let count = 0;
  for (const complaint of due) {
    if (await purgeComplaint(complaint, { deletedBy })) count += 1;
  }
  return count;
}

export async function purgeIfDue(refId, { deletedBy = "request_time_check" } = {}) {
  const complaint = await Complaint.findOne({ ref_id: refId }).select("_id ref_id institute_code delete_after").lean();
  if (!complaint || !complaint.delete_after) return false;
  if (new Date(complaint.delete_after).getTime() > Date.now()) return false;
  return purgeComplaint(complaint, { deletedBy });
}

/**
 * Request-time safety net. The daily scheduler remains the primary mechanism,
 * but public status and staff reads also trigger a throttled sweep so an overdue
 * case cannot remain readable indefinitely if the scheduler is down.
 */
export async function requestTimeSweep() {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return 0;
  lastSweepAt = now;
  return purgeDueComplaints({ limit: 25, deletedBy: "request_time_check" });
}

export function resetSweepThrottleForTests() {
  lastSweepAt = 0;
}
