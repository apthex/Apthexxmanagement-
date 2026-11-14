import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    window_start: { type: Date, required: true },
    count: { type: Number, default: 0 },
    expires_at: { type: Date, required: true },
  },
  { versionKey: false }
);

schema.index({ key: 1, window_start: 1 }, { unique: true });
schema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("RateLimit", schema);
