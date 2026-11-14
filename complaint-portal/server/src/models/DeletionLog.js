import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    ref_id: { type: String, required: true, index: true },
    institute_code: { type: String, required: true },
    deleted_at: { type: Date, default: Date.now, index: true },
    deleted_by: { type: String, default: "system" },
    reason: { type: String, default: "retention_expired" },
  },
  { versionKey: false }
);

export default mongoose.model("DeletionLog", schema);
