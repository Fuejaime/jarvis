import { useState } from 'react';
import { useSettingsStore } from '../../../store/settingsStore.js';
import styles from './Tab.module.css';

const CATEGORIES = ['General', 'Tech', 'Política', 'Economía', 'Ciencia', 'Deportes', 'Cultura'];

export default function FeedsTab() {
  const feeds      = useSettingsStore(s => s.feeds);
  const addFeed    = useSettingsStore(s => s.addFeed);
  const updateFeed = useSettingsStore(s => s.updateFeed);
  const removeFeed = useSettingsStore(s => s.removeFeed);

  const [adding,    setAdding]    = useState(false);
  const [newFeed,   setNewFeed]   = useState({ name: '', url: '', category: 'General' });
  const [editingId, setEditingId] = useState(null);
  const [editFeed,  setEditFeed]  = useState({});

  function handleAdd() {
    if (!newFeed.name.trim() || !newFeed.url.trim()) return;
    addFeed({ ...newFeed });
    setNewFeed({ name: '', url: '', category: 'General' });
    setAdding(false);
  }

  function startEdit(feed) {
    setEditingId(feed.id);
    setEditFeed({ name: feed.name, url: feed.url, category: feed.category });
  }

  function saveEdit() {
    if (!editFeed.name.trim() || !editFeed.url.trim()) return;
    updateFeed(editingId, editFeed);
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <p className={styles.hint}>{feeds.filter(f => f.active).length} feeds activos</p>
        <button className={styles.addBtn} onClick={() => { setAdding(true); setEditingId(null); }}>
          + Añadir
        </button>
      </div>

      {/* Formulario de añadir */}
      {adding && (
        <div className={styles.card} style={{ marginBottom: 'var(--space-3)' }}>
          <div className={styles.cardBody}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Nombre</label>
              <input
                className={styles.input}
                value={newFeed.name}
                onChange={(e) => setNewFeed(p => ({ ...p, name: e.target.value }))}
                placeholder="El País"
                autoFocus
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>URL del feed RSS</label>
              <input
                className={styles.input}
                value={newFeed.url}
                onChange={(e) => setNewFeed(p => ({ ...p, url: e.target.value }))}
                placeholder="https://..."
                type="url"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Categoría</label>
              <select
                className={styles.select}
                value={newFeed.category}
                onChange={(e) => setNewFeed(p => ({ ...p, category: e.target.value }))}
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.row}>
              <button className={styles.cancelBtn} onClick={() => setAdding(false)}>Cancelar</button>
              <button className={styles.saveBtn} onClick={handleAdd}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      <ul className={styles.list}>
        {feeds.map(feed => (
          <li key={feed.id}>
            {/* Modo edición inline */}
            {editingId === feed.id ? (
              <div className={styles.card}>
                <div className={styles.cardBody}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Nombre</label>
                    <input
                      className={styles.input}
                      value={editFeed.name}
                      onChange={(e) => setEditFeed(p => ({ ...p, name: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>URL del feed RSS</label>
                    <input
                      className={styles.input}
                      value={editFeed.url}
                      onChange={(e) => setEditFeed(p => ({ ...p, url: e.target.value }))}
                      type="url"
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Categoría</label>
                    <select
                      className={styles.select}
                      value={editFeed.category}
                      onChange={(e) => setEditFeed(p => ({ ...p, category: e.target.value }))}
                    >
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className={styles.row}>
                    <button className={styles.cancelBtn} onClick={cancelEdit}>Cancelar</button>
                    <button className={styles.saveBtn} onClick={saveEdit}>Guardar</button>
                  </div>
                </div>
              </div>
            ) : (
              /* Vista normal del feed */
              <div className={styles.feedItem}>
                <div className={styles.feedInfo}>
                  <span className={styles.feedName}>{feed.name}</span>
                  <span className={styles.feedUrl}>{feed.url}</span>
                  <span className={styles.feedCategory}>{feed.category}</span>
                </div>
                <div className={styles.feedActions}>
                  <button
                    role="switch"
                    aria-checked={feed.active}
                    className={[styles.toggle, feed.active ? styles.toggleOn : ''].join(' ')}
                    onClick={() => updateFeed(feed.id, { active: !feed.active })}
                  >
                    <span className={styles.toggleThumb} />
                  </button>
                  {/* Botón editar */}
                  <button
                    className={styles.editBtn}
                    onClick={() => startEdit(feed)}
                    aria-label="Editar feed"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  {/* Botón eliminar */}
                  <button
                    className={styles.deleteBtn}
                    onClick={() => removeFeed(feed.id)}
                    aria-label="Eliminar feed"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
