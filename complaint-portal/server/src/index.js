import http from "http";
import app from "./app.js";
import { connectDB, disconnectDB } from "./db/connect.js";
import { env, assertProductionConfig, configWarnings } from "./config/env.js";
import { startScheduler } from "./jobs/scheduler.js";
import { seedDatabase } from "./scripts/seed-data.js";

let server = null;

async function main() {
  assertProductionConfig();
  for (const warning of configWarnings()) console.warn(`[config] ${warning}`);

  await connectDB();
  console.log(`[db] connected to ${env.DATABASE_NAME}`);

  if (env.AUTO_SEED) {
    const result = await seedDatabase({ includeDemoInstitutes: env.NODE_ENV !== "production" });
    console.log(`[seed] auto-seed complete; owner=${result.ownerEmail || "none"}`);
  }

  startScheduler();
  server = http.createServer(app);
  server.listen(env.PORT, () => {
    console.log(`[server] APTHEX Complaint Portal API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

async function shutdown(signal) {
  console.log(`[server] ${signal} received; shutting down`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDB();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main().catch((error) => {
  console.error("[server] failed to start:", error.message);
  process.exit(1);
});
