import { ObjectId } from 'mongodb';
import { users } from '../_lib/db.js';
import { userFromReq } from '../_lib/auth.js';

export default async function handler(req, res) {
  const auth = userFromReq(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const col = await users();
    const user = await col.findOne(
      { _id: new ObjectId(auth.uid) },
      { projection: { passwordHash: 0 } }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({ user: { email: user.email, name: user.name } });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
