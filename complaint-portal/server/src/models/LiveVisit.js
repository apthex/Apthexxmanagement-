import mongoose from "mongoose";

const timelineItemSchema = new mongoose.Schema(
  {
    time: { type: Date, default: Date.now },
    page: { type: String, required: true },
    type: { type: String, enum: ["pageview", "contact_form_submit", "apply_click"], default: "pageview" },
    meta: { type: mongoose.Schema.Types.Mixed },
    time_on_page: { type: Number, default: 0 }, // in seconds
  },
  { _id: false }
);

const liveVisitSchema = new mongoose.Schema(
  {
    visit_id: { type: String, required: true, unique: true, index: true },
    visitor_id: { type: String, required: true, index: true },
    ip: { type: String, default: "" },
    ip_masked: { type: String, default: "" },
    city: { type: String, default: "" },
    country: { type: String, default: "" },
    location: { type: String, default: "Unknown" },
    device: { type: String, default: "Desktop" },
    os: { type: String, default: "Unknown" },
    browser: { type: String, default: "Unknown" },
    source: { type: String, default: "Direct", index: true },
    entry_page: { type: String, default: "/" },
    current_page: { type: String, default: "/" },
    pages_viewed: { type: Number, default: 1 },
    time_on_site: { type: Number, default: 0 }, // in seconds
    first_seen: { type: Date, default: Date.now, index: true },
    last_seen: { type: Date, default: Date.now, index: true },
    form_sent: { type: Boolean, default: false, index: true },
    apply_clicked: { type: Boolean, default: false, index: true },
    apply_role: { type: String, default: "" },
    visit_count: { type: Number, default: 1 },
    timeline: [timelineItemSchema],
  },
  { versionKey: false, timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

liveVisitSchema.index({ last_seen: -1 });
liveVisitSchema.index({ first_seen: -1 });
liveVisitSchema.index({ source: 1, first_seen: -1 });
liveVisitSchema.index({ city: 1 });

export default mongoose.model("LiveVisit", liveVisitSchema);
