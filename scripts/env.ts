import { config } from "dotenv";

// Next.js loads .env.local automatically; CLI scripts do not.
config({ path: ".env.local" });
config();
