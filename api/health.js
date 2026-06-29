import { getDb } from './_lib/db.js';

// Diagnostic endpoint — reports whether env vars are present and the DB connects.
// Returns no secret values, only booleans/status. Visit /api/health after deploy.
export default async function handler(req, res) {
  const hasUri = !!process.env.MONGODB_URI;
  const hasSecret = !!process.env.JWT_SECRET;
  const result = { hasUri, hasSecret, db: 'skipped' };

  if (hasUri) {
    try {
      const db = await getDb();
      await db.command({ ping: 1 });
      result.db = 'connected';
    } catch (e) {
      result.db = 'error';
      result.dbError = e.message;
    }
  }

  const ok = hasUri && hasSecret && result.db === 'connected';
  return res.status(ok ? 200 : 500).json(result);
}
