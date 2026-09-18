import { useEffect, useRef, useState } from 'react';
import type { CityItem } from '../../shared/types';

interface Props {
  selectedId: number;
  selectedName: string;
  onSelect: (id: number, name: string) => void;
}

export default function CityPicker({ selectedId, selectedName, onSelect }: Props) {
  const [q, setQ] = useState(selectedName || '');
  const [items, setItems] = useState<CityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const needle = q.trim();
    if (!needle) {
      setItems([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      let res: CityItem[] = [];
      try {
        res = await window.api.searchCities(needle);
      } catch {
        res = [];
      }
      setItems(res);
      setSearched(true);
      setLoading(false);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  const displayName = (i: CityItem) => (i.region ? `${i.name} (${i.region})` : i.name);

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
        {loading && <span className="hint">поиск…</span>}
        {!loading && searched && <span className="hint">найдено: {items.length}</span>}
      </div>
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
          {items.map((i) => (
            <div
              key={i.id}
              onClick={() => {
                onSelect(Number(i.id), displayName(i));
                setQ(i.name);
              }}
              role="button"
              style={{
                cursor: 'pointer',
                padding: '6px 10px',
                borderRadius: 6,
                background: Number(i.id) === selectedId ? 'rgba(76,134,245,0.2)' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8
              }}
            >
              <span>
                {i.name}
                {i.region ? <span className="hint"> · {i.region}</span> : null}
              </span>
              <span className="hint">#{i.id}</span>
            </div>
          ))}
          {items.length === 0 && !loading && (
            <div className="hint" style={{ padding: 8 }}>
              {!searched
                ? `Введите название города. Сейчас выбрано: ${selectedName || 'не выбрано'}${selectedId ? ` (#${selectedId})` : ''}.`
                : `Ничего не найдено по «${q.trim()}». Сейчас выбрано: ${selectedName || 'не выбрано'}${selectedId ? ` (#${selectedId})` : ''}.`}
            </div>
          )}
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