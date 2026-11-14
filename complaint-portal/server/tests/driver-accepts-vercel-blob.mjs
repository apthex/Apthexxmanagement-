// Subprocess: STORES_DRIVER_FRESH — verifies the env schema accepts
// STORAGE_DRIVER=vercel-blob and that the storage layer reports the same
// driver. Guards against driver-string drift between env.js and storage.js
// (e.g. an older "vercel" value silently breaking the download route).
process.env.STORAGE_DRIVER = "vercel-blob";

const { env } = await import("../src/config/env.js");
const { storageDriver } = await import("../src/services/storage.js");

if (env.STORAGE_DRIVER !== "vercel-blob") {
  console.error(`env.STORAGE_DRIVER=${env.STORAGE_DRIVER}`);
  process.exit(1);
}
if (storageDriver !== "vercel-blob") {
  console.error(`storageDriver=${storageDriver}`);
  process.exit(1);
}
console.log("OK");
