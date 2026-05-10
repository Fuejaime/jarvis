/**
 * /api/copilot/token.js — Obtiene un token de sesión de GitHub Copilot.
 *
 * POST /api/copilot/token
 * Body: { github_token: "gho_..." }
 * Returns: { token: "...", expires_at: 1234567890 }
 *
 * El token de sesión de Copilot dura ~30 minutos.
 * El cliente lo cachea y solo llama aquí cuando expira.
 */

import axios from 'axios';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { github_token } = req.body || {};
  if (!github_token) return res.status(400).json({ error: 'github_token requerido' });

  try {
    const result = await axios.post(
      'https://api.github.com/copilot_internal/v2/token',
      {},
      {
        headers: {
          Authorization:          `token ${github_token}`,
          'Editor-Version':       'vscode/1.85.1',
          'Editor-Plugin-Version':'copilot-chat/0.11.1',
          'User-Agent':           'GitHubCopilotChat/0.11.1',
          'X-Github-Api-Version': '2022-11-28',
        },
      }
    );
    return res.status(200).json({
      token:      result.data.token,
      expires_at: result.data.expires_at,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const msg    = status === 401 ? 'Token de GitHub inválido o sin acceso a Copilot'
                 : status === 403 ? 'Sin licencia de GitHub Copilot en esta cuenta'
                 : err.message;
    return res.status(status).json({ error: msg });
  }
}
