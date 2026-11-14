// One-time bulk import: Nashik district colleges from the open AISHE dataset.
// Idempotent — safe to run again. Usage: node scripts/seed-institutes.mjs [path-to-institutions.json]
// District filter can be overridden: DISTRICT=Nashik node scripts/seed-institutes.mjs
import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import Institute from "../src/models/Institute.js";

const DATA_FILE = process.argv[2] || "/tmp/opencode/institutions.json";
const DISTRICT = (process.env.DISTRICT || "nashik").trim().toLowerCase();
const STATE = (process.env.STATE || "maharashtra").trim().toLowerCase();

function cleanName(raw) {
  let name = String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    // trailing pincode / address junk: "… - 423203." or "… 423203"
    .replace(/[\s-]*\d{6}\s*\.?\s*$/, "")
    .replace(/\s*-\s*$/, "")
    .replace(/\.+$/, "")
    .trim();
  if (name.length > 180) name = `${name.slice(0, 177)}...`;
  return name;
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(path.resolve(DATA_FILE), "utf8"));
  const inDistrict = raw.filter(
    (entry) =>
      String(entry.district || "").trim().toLowerCase() === DISTRICT &&
      String(entry.state || "").trim().toLowerCase() === STATE
  );

  // Deduplicate: one row per AISHE code, and one per cleaned name.
  const byCode = new Map();
  const byName = new Map();
  let skippedNameDupes = 0;
  for (const entry of inDistrict) {
    const code = String(entry.aishe_code || "").trim().toUpperCase();
    const name = cleanName(entry.name);
    if (!code || !name || !/^[A-Z0-9_-]{3,32}$/.test(code)) continue;
    if (byCode.has(code)) continue;
    if (byName.has(name.toUpperCase())) {
      skippedNameDupes += 1;
      continue;
    }
    byCode.set(code, { code, name, type: "college", status: "active" });
    byName.set(name.toUpperCase(), true);
  }

  const docs = [...byCode.values()];
  console.log(`[seed] district rows: ${inDistrict.length}, unique institutes: ${docs.length}, name-duplicates skipped: ${skippedNameDupes}`);

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  const existingCodes = new Set(
    (await Institute.find({ code: { $in: docs.map((doc) => doc.code) } }).select("code").lean()).map((doc) => doc.code)
  );
  const fresh = docs.filter((doc) => !existingCodes.has(doc.code));

  if (fresh.length) await Institute.insertMany(fresh, { ordered: false });
  console.log(`[seed] inserted: ${fresh.length}, already present: ${docs.length - fresh.length}`);
  console.log(`[seed] district colleges now in DB: ${await Institute.countDocuments({ status: "active" })}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("[seed] failed:", error.message);
  process.exit(1);
});
