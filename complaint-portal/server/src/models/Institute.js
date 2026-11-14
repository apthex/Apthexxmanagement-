import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["school", "college", "other"], default: "school" },
    head_name: { type: String, trim: true },
    head_email: { type: String, trim: true, lowercase: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export default mongoose.model("Institute", schema);
