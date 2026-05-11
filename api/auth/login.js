/**
 * POST /api/auth/login
 *
 * Body: { username, password }
 * Returns: { token } — HMAC-SHA256(username, AUTH_SECRET)
 *
 * Variables de entorno requeridas en Vercel:
 *   AUTH_USERNAME — nombre de usuario
 *   AUTH_PASSWORD — contraseña
 *   AUTH_SECRET   — cadena aleatoria larga (actúa como clave de firma)
 */
import crypto from 'crypto';

/** Comparación en tiempo constante para evitar timing attacks */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Comparar igualmente para no filtrar longitud
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { AUTH_USERNAME, AUTH_PASSWORD, AUTH_SECRET } = process.env;

  if (!AUTH_USERNAME || !AUTH_PASSWORD || !AUTH_SECRET) {
    return res.status(500).json({
      error: 'Auth no configurado. Añade AUTH_USERNAME, AUTH_PASSWORD y AUTH_SECRET en Vercel.',
    });
  }

  const { username = '', password = '' } = req.body ?? {};

  const userOk = safeEqual(username, AUTH_USERNAME);
  const passOk = safeEqual(password, AUTH_PASSWORD);

  if (!userOk || !passOk) {
    // Mismo mensaje para no filtrar si falla usuario o contraseña
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  // Token determinista: HMAC-SHA256(username, secret)
  // No tiene expiración intencionalmente (app personal, sesión permanente).
  const token = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(AUTH_USERNAME)
    .digest('hex');

  return res.status(200).json({ token });
}
