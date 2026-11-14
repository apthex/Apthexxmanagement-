import mongoose from "mongoose";
import { connectDB } from "../db/connect.js";
import { seedDatabase } from "./seed-data.js";
import { isProduction } from "../config/env.js";

await connectDB();
const result = await seedDatabase({ includeDemoInstitutes: false });
console.log(
  JSON.stringify(
    {
      seeded: true,
      demoInstitutes: result.institutes,
      owner: result.ownerEmail,
      defaultPasswordUsed: result.defaultOwnerPasswordUsed,
      note: result.defaultOwnerPasswordUsed
        ? "Development owner password is ChangeMe!123. Enrol 2FA on first login. Never use this in production."
        : "Owner password came from SEED_OWNER_PASSWORD.",
    },
    null,
    2
  )
);
await mongoose.disconnect();
