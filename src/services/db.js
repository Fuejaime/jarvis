/**
 * db.js — Wrapper de IndexedDB con idb.
 *
 * Stores:
 *   - articles     → artículos RSS cacheados (key: id)
 *   - readState    → { id, read, savedAt } (key: id)
 *   - clusters     → clusters calculados, cacheados 1h (key: feedsHash)
 *   - chatHistory  → historial del assistant (key: id)
 */

import { openDB } from 'idb';

const DB_NAME    = 'jarvis-db';
const DB_VERSION = 1;

let _db = null;

async function getDb() {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Artículos RSS
      if (!db.objectStoreNames.contains('articles')) {
        const store = db.createObjectStore('articles', { keyPath: 'id' });
        store.createIndex('date', 'date');
        store.createIndex('sourceId', 'sourceId');
      }
      // Estado de lectura
      if (!db.objectStoreNames.contains('readState')) {
        db.createObjectStore('readState', { keyPath: 'id' });
      }
      // Clusters cacheados
      if (!db.objectStoreNames.contains('clusters')) {
        db.createObjectStore('clusters', { keyPath: 'key' });
      }
      // Historial de chats
      if (!db.objectStoreNames.contains('chatHistory')) {
        const h = db.createObjectStore('chatHistory', { keyPath: 'id' });
        h.createIndex('createdAt', 'createdAt');
      }
    },
  });
  return _db;
}

// ─── Articles ──────────────────────────────────────────────────────────────────

export async function saveArticles(articles) {
  const db = await getDb();
  const tx = db.transaction('articles', 'readwrite');
  await Promise.all(articles.map(a => tx.store.put(a)));
  await tx.done;
}

export async function getArticles() {
  const db = await getDb();
  return db.getAllFromIndex('articles', 'date');
}

export async function clearOldArticles(maxAge = 7 * 24 * 60 * 60 * 1000) {
  const db      = await getDb();
  const cutoff  = new Date(Date.now() - maxAge).toISOString();
  const all     = await db.getAll('articles');
  const old     = all.filter(a => a.date < cutoff);
  const tx      = db.transaction('articles', 'readwrite');
  await Promise.all(old.map(a => tx.store.delete(a.id)));
  await tx.done;
}

// ─── Read state ────────────────────────────────────────────────────────────────

export async function getReadState() {
  const db   = await getDb();
  const rows = await db.getAll('readState');
  return new Set(rows.filter(r => r.read).map(r => r.id));
}

export async function markRead(id, read = true) {
  const db = await getDb();
  await db.put('readState', { id, read, savedAt: new Date().toISOString() });
}

export async function markAllRead(ids) {
  const db = await getDb();
  const tx = db.transaction('readState', 'readwrite');
  await Promise.all(ids.map(id => tx.store.put({ id, read: true, savedAt: new Date().toISOString() })));
  await tx.done;
}

// ─── Clusters cache ────────────────────────────────────────────────────────────

export async function getCachedClusters(key) {
  const db  = await getDb();
  const row = await db.get('clusters', key);
  if (!row) return null;
  // Expira en 1h
  if (Date.now() - row.cachedAt > 60 * 60 * 1000) {
    await db.delete('clusters', key);
    return null;
  }
  return row.clusters;
}

export async function saveClusters(key, clusters) {
  const db = await getDb();
  await db.put('clusters', { key, clusters, cachedAt: Date.now() });
}

// ─── Chat history ──────────────────────────────────────────────────────────────

export async function saveChat(chat) {
  const db = await getDb();
  await db.put('chatHistory', chat);
}

export async function getChats(limit = 20) {
  const db   = await getDb();
  const all  = await db.getAllFromIndex('chatHistory', 'createdAt');
  return all.reverse().slice(0, limit);
}

export async function deleteChat(id) {
  const db = await getDb();
  await db.delete('chatHistory', id);
}
