import bcrypt from 'bcryptjs';
import { users } from '../_lib/db.js';
import { signToken, readBody } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { email, password, name } = await readBody(req);
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Email and a 6+ char password required.' });
    }
    const col = await users();
    const normalized = String(email).trim().toLowerCase();
    const existing = await col.findOne({ email: normalized });
    if (existing) return res.status(409).json({ error: 'That email is already registered.' });

    const hash = await bcrypt.hash(password, 10);
    const doc = {
      email: normalized,
      name: name?.trim() || normalized.split('@')[0],
      passwordHash: hash,
      state: null,
      createdAt: new Date(),
    };
    const { insertedId } = await col.insertOne(doc);
    const token = signToken({ uid: String(insertedId), email: normalized });
    return res.status(201).json({ token, user: { email: normalized, name: doc.name } });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
