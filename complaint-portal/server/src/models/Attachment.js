import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    complaint_id: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", required: true, index: true },
    type: { type: String, enum: ["image", "voice", "video"], required: true },
    storage_key: { type: String, required: true },
    mime: { type: String, required: true },
    size_bytes: { type: Number, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

schema.index({ complaint_id: 1, created_at: 1 });

export default mongoose.model("Attachment", schema);
