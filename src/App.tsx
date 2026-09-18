import { useEffect, useState } from 'react';
import type { UpdateState } from '../shared/types';
import Generator from './screens/Generator';
import Schedule from './screens/Schedule';
import Settings from './screens/Settings';
import AlarmPopup from './components/AlarmPopup';

function b64ToJson(b64url: string): unknown {
  let s = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const isAlarm = params.get('route') === 'alarm';

  if (isAlarm) {
    const data = params.get('payload');
    let payload: unknown = null;
    if (data) {
      try {
        payload = b64ToJson(data);
      } catch {
        payload = null;
      }
    }
    return <AlarmPopup payload={payload} />;
  }

  const [state, setState] = useState<UpdateState | null>(null);
  const [tab, setTab] = useState<'generator' | 'schedule' | 'settings'>('schedule');
  const [busy, setBusy] = useState(false);

  async function load(): Promise<void> {
    try {
      setState(await window.api.getState());
    } catch {
      setState(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (!state) {
    return (
      <div className="boot">
        <div className="spinner" />
        <p>Загрузка…</p>
      </div>
    );
  }

  const prayer = state.prayer;
  const offline = !prayer.ok || prayer.offline;
  const netBadge =
    !prayer.ok
      ? 'нет намазов'
      : offline
        ? `кэш · от ${prayer.sourceDate}`
        : 'онлайн';
  const netTitle = !prayer.ok
    ? 'Нет данных о намазах.'
    : offline
      ? `Времена намазов показываются из сохранённого кэша (от ${prayer.sourceDate}). Кэш действителен только на этот день.`
      : 'Времена намазов загружены из интернета.';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Мой день</div>
        <nav className="tabs">
          <button className={tab === 'schedule' ? 'tab active' : 'tab'} onClick={() => setTab('schedule')}>
            Расписание
          </button>
          <button className={tab === 'generator' ? 'tab active' : 'tab'} onClick={() => setTab('generator')}>
            Задачи
          </button>
          <button className={tab === 'settings' ? 'tab active' : 'tab'} onClick={() => setTab('settings')}>
            Настройки
          </button>
        </nav>
        <div className="topmeta">
          <span className="city">{state.settings.cityName || 'Город не выбран'}</span>
          <span title={netTitle} className={offline ? 'badge off' : 'badge on'}>
            {netBadge}
          </span>
          {busy && (
            <span className="badge busy" title="Выполняется…">
              <span className="spinner-mini" />
            </span>
          )}
        </div>
      </header>

      <main className="content">
        {tab === 'schedule' && <Schedule state={state} onReload={load} setBusy={setBusy} />}
        {tab === 'generator' && <Generator state={state} onSaved={async () => load()} />}
        {tab === 'settings' && <Settings state={state} onSaved={async () => load()} />}
      </main>
    </div>
  );
}

export default App;