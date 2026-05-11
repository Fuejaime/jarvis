/**
 * POST /api/auth/verify
 *
 * Body: { token }
 * Returns: { ok: true } | 401
 *
 * Verifica que el token almacenado en el cliente sea válido.
 * Se llama al iniciar la app para evitar que alguien ponga cualquier
 * valor en localStorage y acceda.
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

  const { token = '' } = req.body ?? {};

  const validToken = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(AUTH_USERNAME)
    .digest('hex');

  if (token !== validToken) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  return res.status(200).json({ ok: true });
}
