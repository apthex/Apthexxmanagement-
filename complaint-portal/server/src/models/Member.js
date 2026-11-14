import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ["owner", "case_team"], default: "case_team", index: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    totp_secret: { type: String },
    totp_enabled: { type: Boolean, default: false },
    totp_pending_secret: { type: String },
    totp_setup_token_hash: { type: String },
    totp_setup_expires: { type: Date },
    failed_login_count: { type: Number, default: 0 },
    locked_until: { type: Date },
    last_login_at: { type: Date },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export default mongoose.model("Member", schema);
