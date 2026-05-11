/**
 * useAuth.js
 *
 * Gestiona el estado de autenticación de la app.
 *
 * Flujo:
 *  1. Al montar, lee el token de localStorage y lo verifica en el servidor.
 *  2. Si el token es válido → authenticated = true.
 *  3. Si hay error de red (PWA offline) → asume válido (token existe).
 *  4. login(user, pass) → POST /api/auth/login → guarda token.
 *  5. logout() → elimina token de localStorage.
 */
import { useState, useEffect } from 'react';

const TOKEN_KEY = 'jarvis:authToken';

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading,       setLoading]       = useState(true);

  // Verificar token al iniciar
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setLoading(false);
      return;
    }

    fetch('/api/auth/verify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token }),
    })
      .then(res => {
        if (res.ok) {
          setAuthenticated(true);
        } else {
          // Token inválido (posiblemente cambiaron las credenciales del servidor)
          localStorage.removeItem(TOKEN_KEY);
        }
      })
      .catch(() => {
        // Sin red (modo offline) → si el token existe, asumimos que es válido
        // para no bloquear al usuario cuando no hay conexión.
        setAuthenticated(true);
      })
      .finally(() => setLoading(false));
  }, []);

  /** Lanza login. Lanza Error si las credenciales son incorrectas. */
  async function login(username, password) {
    const res = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Error de autenticación');
    }

    const { token } = await res.json();
    localStorage.setItem(TOKEN_KEY, token);
    setAuthenticated(true);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setAuthenticated(false);
  }

  return { authenticated, loading, login, logout };
}
