import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    token_hash: { type: String, required: true, unique: true, index: true },
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true, index: true },
    csrf_hash: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    last_seen_at: { type: Date, default: Date.now },
    expires_at: { type: Date, required: true },
    revoked_at: { type: Date, default: null },
    revoked_reason: { type: String },
  },
  { versionKey: false }
);

schema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("StaffSession", schema);
