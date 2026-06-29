import { ObjectId } from 'mongodb';
import { users } from './_lib/db.js';
import { userFromReq, readBody } from './_lib/auth.js';

// GET  -> returns the signed-in user's saved WatchNext state (or null)
// PUT  -> persists the posted state for the signed-in user
export default async function handler(req, res) {
  const auth = userFromReq(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const col = await users();
    const _id = new ObjectId(auth.uid);

    if (req.method === 'GET') {
      const user = await col.findOne({ _id }, { projection: { state: 1 } });
      return res.status(200).json({ state: user?.state ?? null });
    }

    if (req.method === 'PUT') {
      const { state } = await readBody(req);
      await col.updateOne({ _id }, { $set: { state, updatedAt: new Date() } });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
