/**
 * POST /api/auth/verify
 *
 * Body: { token }
 * Returns: { ok: true } | 401
 */
import crypto from 'crypto';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { AUTH_USERNAME, AUTH_SECRET } = process.env;

  if (!AUTH_USERNAME || !AUTH_SECRET) {
    return res.status(500).json({ error: 'Auth no configurado' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const token = String((body ?? {}).token ?? '').trim();

  const validToken = crypto
    .createHmac('sha256', AUTH_SECRET.trim())
    .update(AUTH_USERNAME.trim())
    .digest('hex');

  if (token !== validToken) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  return res.status(200).json({ ok: true });
}
