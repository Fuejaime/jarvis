/**
 * POST /api/auth/login
 *
 * Body: { username, password }
 * Returns: { token } — HMAC-SHA256(username, AUTH_SECRET)
 *
 * Variables de entorno requeridas en Vercel:
 *   AUTH_USERNAME — nombre de usuario
 *   AUTH_PASSWORD — contraseña
 *   AUTH_SECRET   — cadena aleatoria larga (clave de firma)
 */
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { AUTH_USERNAME, AUTH_PASSWORD, AUTH_SECRET } = process.env;

  if (!AUTH_USERNAME || !AUTH_PASSWORD || !AUTH_SECRET) {
    return res.status(500).json({
      error: 'Auth no configurado. Añade AUTH_USERNAME, AUTH_PASSWORD y AUTH_SECRET en Vercel.',
    });
  }

  // Parsear body — Vercel a veces entrega string en lugar de objeto
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body ?? {};

  // Trim para evitar problemas con espacios accidentales
  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '').trim();
  const envUser  = AUTH_USERNAME.trim();
  const envPass  = AUTH_PASSWORD.trim();

  // Comparación en tiempo constante para evitar timing attacks
  // timingSafeEqual requiere buffers de igual longitud
  function safeEqual(a, b) {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) {
      // Ejecutar igualmente para no filtrar info por tiempo
      crypto.timingSafeEqual(ba, ba);
      return false;
    }
    return crypto.timingSafeEqual(ba, bb);
  }

  const userOk = safeEqual(username, envUser);
  const passOk = safeEqual(password, envPass);

  if (!userOk || !passOk) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const token = crypto
    .createHmac('sha256', AUTH_SECRET.trim())
    .update(envUser)
    .digest('hex');

  return res.status(200).json({ token });
}
