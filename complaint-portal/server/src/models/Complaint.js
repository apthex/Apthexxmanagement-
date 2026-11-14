import mongoose from "mongoose";

export const CATEGORIES = [
  "Blackmail and Sextortion",
  "Online Harassment or Bullying",
  "Financial Fraud or Threats",
  "Fake Profiles or Account Hacking",
  "Institution-level Issue",
  "Urgent safety concern",
];

const schema = new mongoose.Schema(
  {
    ref_id: { type: String, required: true, unique: true, index: true },
    institute_code: { type: String, required: true, uppercase: true, index: true },
    category: { type: String, required: true, enum: CATEGORIES },
    details_text: { type: String, required: true },
    details_hash: { type: String, required: true, index: true },
    urgent: { type: Boolean, default: false, index: true },
    mode: { type: String, enum: ["identified", "anonymous"], required: true },
    // Only stored for identified complaints. Anonymous complaints must never contain this.
    class_label: { type: String },
    status: { type: String, enum: ["in_process", "completed"], default: "in_process", index: true },
    flagged_spam: { type: Boolean, default: false, index: true },
    escalated: { type: Boolean, default: false },
    assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: "Member" },
    created_at: { type: Date, default: Date.now, index: true },
    completed_at: { type: Date },
    delete_after: { type: Date },
  },
  { versionKey: false }
);

schema.index({ institute_code: 1, created_at: -1 });
schema.index({ status: 1, created_at: -1 });
schema.index({ flagged_spam: 1, created_at: -1 });
schema.index({ delete_after: 1 }, { partialFilterExpression: { delete_after: { $type: "date" } } });
schema.index({ details_hash: 1, institute_code: 1, created_at: -1 });

export default mongoose.model("Complaint", schema);
