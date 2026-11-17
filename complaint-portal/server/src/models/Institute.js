import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    // Name is empty for codes that were generated but not yet assigned to a
    // college (admin panel flow). Unassigned codes never validate publicly.
    name: { type: String, default: "", trim: true },
    type: { type: String, enum: ["school", "college", "other"], default: "school" },
    head_name: { type: String, trim: true },
    head_email: { type: String, trim: true, lowercase: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export default mongoose.model("Institute", schema);
