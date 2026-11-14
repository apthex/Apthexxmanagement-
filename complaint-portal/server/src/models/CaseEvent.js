import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    complaint_id: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", required: true, index: true },
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: "Member", default: null },
    event: { type: String, required: true },
    note: { type: String },
    occurred_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

schema.index({ complaint_id: 1, occurred_at: 1 });

export default mongoose.model("CaseEvent", schema);
