/**
 * GET /api/auth/debug — diagnóstico temporal, NO expone valores reales.
 * Borrar cuando el login funcione.
 */
export default function handler(req, res) {
  const u = process.env.AUTH_USERNAME ?? '';
  const p = process.env.AUTH_PASSWORD ?? '';
  const s = process.env.AUTH_SECRET   ?? '';

  // Solo expone longitudes y primeros/últimos caracteres, nunca el valor completo
  res.json({
    AUTH_USERNAME: { set: !!u, length: u.length, first: u[0] ?? null, last: u[u.length - 1] ?? null },
    AUTH_PASSWORD: { set: !!p, length: p.length, first: p[0] ?? null, last: p[p.length - 1] ?? null },
    AUTH_SECRET:   { set: !!s, length: s.length },
  });
}
