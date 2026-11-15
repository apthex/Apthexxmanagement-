// Vercel Serverless entry for the complaint API.
// Each invocation reuses the cached mongoose connection on warm instances;
// cold instances connect before the first request is served.
import app from "../src/app.js";
import { connectDB } from "../src/db/connect.js";

let dbPromise = null;

function ensureDB() {
  if (!dbPromise) {
    dbPromise = connectDB().catch((error) => {
      dbPromise = null; // allow a retry on the next invocation
      throw error;
    });
  }
  return dbPromise;
}

export default async function handler(req, res) {
  try {
    await ensureDB();
  } catch (error) {
    console.error("[api] database connection failed:", error.message);
    res.status(503).json({ error: "Database connection failed, please retry" });
    return;
  }
  return app(req, res);
}
