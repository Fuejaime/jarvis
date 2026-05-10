/**
 * /api/auth/github/callback.js — Callback OAuth de GitHub.
 *
 * 1. Intercambia el code por un access_token de GitHub.
 * 2. Lee el usuario autenticado.
 * 3. Redirige al app con los datos en query params.
 */

import axios from 'axios';

export default async function handler(req, res) {
  const { code, state } = req.query;
  const appUrl = process.env.APP_URL || 'https://jarvis-pwa-one.vercel.app';

  if (!code || state !== 'jarvis-oauth') {
    return res.redirect(302, `${appUrl}/?auth_error=invalid_state`);
  }

  try {
    // 1. Intercambiar code por access_token
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id:     process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: 'application/json' } }
    );

    const { access_token, error: ghError } = tokenRes.data;
    if (ghError || !access_token) {
      return res.redirect(302, `${appUrl}/?auth_error=${encodeURIComponent(ghError || 'no_token')}`);
    }

    // 2. Obtener nombre del usuario
    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${access_token}` },
    });
    const { login: githubUser } = userRes.data;

    // 3. Redirigir al app con el token en query param
    //    El app lo captura, lo guarda en localStorage y limpia la URL.
    return res.redirect(302,
      `${appUrl}/?github_token=${encodeURIComponent(access_token)}&github_user=${encodeURIComponent(githubUser)}`
    );
  } catch (err) {
    return res.redirect(302, `${appUrl}/?auth_error=${encodeURIComponent(err.message)}`);
  }
}
