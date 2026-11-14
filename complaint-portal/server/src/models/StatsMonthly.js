import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    institute_code: { type: String, required: true, uppercase: true },
    month: { type: String, required: true }, // YYYY-MM
    received: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    escalated: { type: Number, default: 0 },
    by_category: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { versionKey: false }
);

schema.index({ institute_code: 1, month: 1 }, { unique: true });

export default mongoose.model("StatsMonthly", schema);
