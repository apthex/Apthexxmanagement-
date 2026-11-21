import { MongoClient, Db } from "mongodb";

const options = {};

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | null = null;

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please define MONGODB_URI in environment variables");
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }

  if (!clientPromise) {
    const client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }
  return clientPromise;
}

/**
 * Returns the connected MongoDB Database instance.
 * Defaults to the 'Apethexhelpportal' database.
 */
export async function getMongoDb(dbName = "Apethexhelpportal"): Promise<Db> {
  const promise = getClientPromise();
  const connectedClient = await promise;
  return connectedClient.db(dbName);
}

export { getClientPromise as clientPromise };
export default getClientPromise;
