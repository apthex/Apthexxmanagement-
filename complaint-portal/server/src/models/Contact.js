import mongoose from "mongoose";

// Reporter identity is deliberately kept in a separate collection so that
// anonymous complaints can never be linked to a person.
const schema = new mongoose.Schema(
  {
    complaint_id: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", required: true },
    kind: { type: String, enum: ["reporter"], default: "reporter" },
    name: { type: String, required: true, trim: true },
    roll_no: { type: String, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

schema.index({ complaint_id: 1 }, { unique: true });

export default mongoose.model("Contact", schema);
