import bcrypt from "bcrypt";
import Institute from "../models/Institute.js";
import Member from "../models/Member.js";
import { env, isProduction } from "../config/env.js";

const DEMO_INSTITUTES = [
  {
    code: "SCHOOL01",
    name: "Demo Public School",
    type: "school",
    head_name: "Principal",
    head_email: "head@example.com",
    status: "active",
  },
  {
    code: "COLLEGE01",
    name: "Demo Engineering College",
    type: "college",
    head_name: "Director",
    head_email: "director@example.com",
    status: "active",
  },
];

export async function seedDatabase({ includeDemoInstitutes = false } = {}) {
  if (isProduction && includeDemoInstitutes) {
    console.warn("[seed] Demo institutes are disabled in production. Add real institutes through the approved data process.");
    includeDemoInstitutes = false;
  }

  let institutes = 0;
  if (includeDemoInstitutes) {
    for (const institute of DEMO_INSTITUTES) {
      await Institute.updateOne(
        { code: institute.code },
        { $setOnInsert: { ...institute, created_at: new Date() } },
        { upsert: true }
      );
      institutes += 1;
    }
  }

  const ownerEmail = (env.SEED_OWNER_EMAIL || (isProduction ? "" : "owner@apthex.local")).toLowerCase();
  const ownerPassword = env.SEED_OWNER_PASSWORD || (isProduction ? "" : "Apthex2026@#");
  let owner = null;

  if (ownerEmail && ownerPassword) {
    const existing = await Member.findOne({ email: ownerEmail });
    if (!existing) {
      owner = await Member.create({
        name: "APTHEX Owner",
        email: ownerEmail,
        password_hash: await bcrypt.hash(ownerPassword, 12),
        role: "owner",
        status: "active",
      });
    } else {
      owner = existing;
    }
  } else if (isProduction) {
    throw new Error("SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD are required to seed the first owner in production");
  }

  // Teachers/colleges are added by the owner through the Case Desk panel, not
  // seeded — so no demo teacher account exists anymore.
  return {
    institutes,
    ownerCreated: Boolean(owner),
    ownerEmail: owner?.email || null,
    defaultOwnerPasswordUsed: !env.SEED_OWNER_PASSWORD && !isProduction,
  };
}
