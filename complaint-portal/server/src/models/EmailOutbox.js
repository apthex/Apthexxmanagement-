import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    dedupe_key: { type: String, required: true, unique: true, index: true },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    text: { type: String, required: true },
    kind: {
      type: String,
      enum: ["new_complaint", "urgent", "reporter_confirmation", "monthly_report", "escalation", "system", "test"],
      required: true,
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["pending", "sending", "sent", "dev_logged", "failed", "dead"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    next_attempt_at: { type: Date, default: Date.now, index: true },
    locked_at: { type: Date },
    last_error: { type: String },
    provider_message_id: { type: String },
    created_at: { type: Date, default: Date.now },
    sent_at: { type: Date },
    expires_at: { type: Date, required: true },
  },
  { versionKey: false }
);

schema.index({ status: 1, next_attempt_at: 1 });
schema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("EmailOutbox", schema);
