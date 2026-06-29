import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

// Reuse the client across serverless invocations (cached on globalThis).
let cached = globalThis.__mongo;

export async function getDb() {
  if (!uri) throw new Error('MONGODB_URI is not set');
  if (!cached) {
    const client = new MongoClient(uri);
    cached = { client, promise: client.connect() };
    globalThis.__mongo = cached;
  }
  await cached.promise;
  return cached.client.db('watchnext');
}

export async function users() {
  const db = await getDb();
  const col = db.collection('users');
  await col.createIndex({ email: 1 }, { unique: true }).catch(() => {});
  return col;
}
