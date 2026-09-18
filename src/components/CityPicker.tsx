import { useEffect, useMemo, useState } from 'react';
import type { CityMap } from '../../shared/types';

interface Props {
  selectedId: number;
  selectedName: string;
  onSelect: (id: number, name: string) => void;
}

export default function CityPicker({ selectedId, selectedName, onSelect }: Props) {
  const [cities, setCities] = useState<CityMap>({});
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        let map = await window.api.getCities();
        if (Object.keys(map).length > 0) {
          setCities(map);
          // silent background refresh
          window.api.fetchCities().then(setCities).catch(() => undefined);
        } else {
          map = await window.api.fetchCities();
          setCities(map);
        }
        setLoading(false);
      } catch (e) {
        setErr(String(e));
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const entries = Object.entries(cities);
    const needle = q.trim().toLowerCase();
    if (!needle) return entries.slice(0, 40);
    return entries
      .filter(([id, name]) => name.toLowerCase().includes(needle) || id === q.trim())
      .slice(0, 80);
  }, [cities, q]);

  return (
    <div>
      <div className="row">
        <input
          type="text"
          placeholder="Поиск города…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1 }}
        />
        {loading && <span className="hint">загрузка…</span>}
      </div>
      {err && <p className="errbox" style={{ marginTop: 8 }}>{err}</p>}
      <div style={{ position: 'relative', marginTop: 8 }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            zIndex: 20,
            background: '#111827',
            border: '1px solid #334155',
            borderRadius: 10,
            maxHeight: 240,
            overflowY: 'auto',
            padding: 4
          }}
        >
          {filtered.map(([id, name]) => (
            <div
              key={id}
              onClick={() => onSelect(Number(id), name)}
              role="button"
              style={{
                cursor: 'pointer',
                padding: '6px 10px',
                borderRadius: 6,
                background: Number(id) === selectedId ? 'rgba(76,134,245,0.2)' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8
              }}
            >
              <span>{name}</span>
              <span className="hint">#{id}</span>
            </div>
          ))}
          {filtered.length === 0 && <div className="hint" style={{ padding: 8 }}>Ничего не найдено</div>}
        </div>
      </div>
      <div className="row" style={{ marginTop: 4 }}>
        <span>
          Выбрано: <b>{selectedName || 'не выбрано'}</b> #{selectedId}
        </span>
      </div>
    </div>
  );
}