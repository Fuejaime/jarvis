/**
 * GET /api/auth/debug — diagnóstico temporal, NO expone valores reales.
 * Borrar cuando el login funcione.
 */
export default function handler(req, res) {
  const u = process.env.AUTH_USERNAME ?? '';
  const p = process.env.AUTH_PASSWORD ?? '';
  const s = process.env.AUTH_SECRET   ?? '';

  // Muestra char codes para detectar caracteres invisibles / encoding raro
  const charCodes = (str) => [...str].map(c => c.charCodeAt(0));

  res.json({
    AUTH_USERNAME: { length: u.length, chars: charCodes(u) },
    AUTH_PASSWORD: { length: p.length, chars: charCodes(p) },
    AUTH_SECRET:   { length: s.length },
  });
}
