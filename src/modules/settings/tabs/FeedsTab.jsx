import { useState } from 'react';
import { useSettingsStore } from '../../../store/settingsStore.js';
import styles from './Tab.module.css';

export default function FeedsTab() {
  const feeds     = useSettingsStore(s => s.feeds);
  const addFeed   = useSettingsStore(s => s.addFeed);
  const updateFeed = useSettingsStore(s => s.updateFeed);
  const removeFeed = useSettingsStore(s => s.removeFeed);

  const [adding, setAdding] = useState(false);
  const [newFeed, setNewFeed] = useState({ name: '', url: '', category: 'General' });

  const CATEGORIES = ['General', 'Tech', 'Política', 'Economía', 'Ciencia', 'Deportes', 'Cultura'];

  function handleAdd() {
    if (!newFeed.name.trim() || !newFeed.url.trim()) return;
    addFeed({ ...newFeed });
    setNewFeed({ name: '', url: '', category: 'General' });
    setAdding(false);
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <p className={styles.hint}>{feeds.filter(f => f.active).length} feeds activos</p>
        <button className={styles.addBtn} onClick={() => setAdding(true)}>+ Añadir</button>
      </div>

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
          <li key={feed.id} className={styles.feedItem}>
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
          </li>
        ))}
      </ul>
    </div>
  );
}
