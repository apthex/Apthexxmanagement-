import mongoose from "mongoose";
import { env, isProduction } from "../config/env.js";

let memoryServer = null;

export async function connectDB(uriOverride) {
  let uri = uriOverride || env.MONGODB_URI;
  if (!uri) {
    if (isProduction) throw new Error("MONGODB_URI is required in production");
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
    console.warn("[db] MONGODB_URI not set; using in-memory MongoDB (development only, data is not persisted)");
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    dbName: env.DATABASE_NAME,
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
  });
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
