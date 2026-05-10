/**
 * /api/auth/github.js — Inicia el flujo OAuth de GitHub.
 *
 * Requiere variables de entorno en Vercel:
 *   GITHUB_CLIENT_ID      — ID de tu GitHub OAuth App
 *   GITHUB_CLIENT_SECRET  — Secret de tu GitHub OAuth App
 *   APP_URL               — https://jarvis-pwa-one.vercel.app
 */

export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const appUrl   = process.env.APP_URL || 'https://jarvis-pwa-one.vercel.app';

  if (!clientId) {
    return res.status(500).json({
      error: 'GITHUB_CLIENT_ID no configurado. Añádelo en las variables de entorno de Vercel.',
    });
  }

  const params = new URLSearchParams({
    client_id:    clientId,
    redirect_uri: `${appUrl}/api/auth/github/callback`,
    scope:        'user:email',
    state:        'jarvis-oauth',
  });

  res.redirect(302, `https://github.com/login/oauth/authorize?${params}`);
}
