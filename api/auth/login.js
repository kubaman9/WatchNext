import bcrypt from 'bcryptjs';
import { users } from '../_lib/db.js';
import { signToken, readBody } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { email, password } = await readBody(req);
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

    const col = await users();
    const normalized = String(email).trim().toLowerCase();
    const user = await col.findOne({ email: normalized });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = signToken({ uid: String(user._id), email: normalized });
    return res.status(200).json({ token, user: { email: normalized, name: user.name } });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
