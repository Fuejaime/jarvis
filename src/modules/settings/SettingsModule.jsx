import { useState } from 'react';
import ProvidersTab from './tabs/ProvidersTab.jsx';
import FeedsTab from './tabs/FeedsTab.jsx';
import PreferencesTab from './tabs/PreferencesTab.jsx';
import styles from './SettingsModule.module.css';

const TABS = [
  { id: 'providers',    label: 'Proveedores IA' },
  { id: 'feeds',        label: 'Feeds RSS' },
  { id: 'preferences', label: 'Preferencias' },
];

export default function SettingsModule() {
  const [activeTab, setActiveTab] = useState('providers');

  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>Ajustes</h1>
      </header>

      <div className={styles.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={[styles.tab, activeTab === tab.id ? styles.tabActive : ''].join(' ')}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {activeTab === 'providers'    && <ProvidersTab />}
        {activeTab === 'feeds'        && <FeedsTab />}
        {activeTab === 'preferences'  && <PreferencesTab />}
      </div>
    </div>
  );
}
