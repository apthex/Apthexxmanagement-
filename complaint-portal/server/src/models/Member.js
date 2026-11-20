import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    // Stored in readable form for staff/teacher account management by the owner,
    // so owners don't have to keep resetting the password to view it.
    last_password_issued: { type: String, default: "" },
    role: { type: String, enum: ["owner", "case_team"], default: "case_team", index: true },
    // case_team (teacher) accounts are scoped to one institute ref ID — they
    // only see complaints submitted against that college. Empty for owners.
    institute_code: { type: String, default: "", uppercase: true, trim: true, index: true },
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
