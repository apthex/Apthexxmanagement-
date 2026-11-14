import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    occurred_at: { type: Date, default: Date.now, index: true },
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: "Member", default: null },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entity_id: { type: String },
    outcome: { type: String, enum: ["success", "failure"], default: "success" },
    // Stored as a SHA-256 hash. Raw IP addresses are not retained.
    ip: { type: String },
    detail: { type: String },
  },
  { versionKey: false }
);

schema.index({ member_id: 1, occurred_at: -1 });
schema.index({ entity: 1, entity_id: 1 });

export default mongoose.model("AuditEvent", schema);
