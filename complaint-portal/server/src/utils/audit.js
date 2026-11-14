import AuditEvent from "../models/AuditEvent.js";
import { hashIp } from "./hash.js";

/**
 * Append-only security audit event. Never pass complaint text, contact data,
 * evidence contents or secrets in `detail`.
 */
export async function audit({
  member_id = null,
  action,
  entity,
  entity_id = null,
  outcome = "success",
  ip = null,
  detail = null,
}) {
  try {
    await AuditEvent.create({
      member_id,
      action,
      entity,
      entity_id: entity_id === null ? null : String(entity_id).slice(0, 160),
      outcome,
      ip: hashIp(ip),
      detail: detail === null ? null : String(detail).slice(0, 1000),
    });
  } catch (error) {
    console.error("[audit] write failed:", error.message);
  }
}
