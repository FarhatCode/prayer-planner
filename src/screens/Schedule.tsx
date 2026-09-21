import { useCallback, useEffect, useRef, useState } from 'react';
import type { DayPlan, PEntry, Qaylulah, RegisterResult, UpdateState } from '../../shared/types';
import { formatDateRu, nowHHMM, parseHHMM, toHHMM } from '../lib/fmt';
import { qayluAllowedStarts, qayluAutoStart, qayluRangesLabel } from '../lib/qaylulah';

interface Props {
  state: UpdateState;
  onReload: () => void;
  setBusy: (b: boolean) => void;
}

interface Section {
  title: string;
  entries: PEntry[];
}

const DOT: Record<string, string> = {
  wake: '#f472b6',
  prayer: '#34d399',
  study: '#4c86f5',
  break: '#f5a623',
  rest: '#64748b',
  prep: '#a78bfa',
  sleep: '#334155',
  qaylulah: '#f59e0b'
};

function sectionTitle(e: PEntry): string {
  const time = e.end ? `${e.time} — ${e.end}` : e.time;
  if (e.type === 'qaylulah') return `${e.title} · ${time}`;
  if (e.type === 'wake') return `Подъем · ${time}`;
  if (e.type === 'sleep') return `Отбой · ${time}`;
  if (e.type === 'prayer') return `${e.title} · ${time}`;
  return 'День';
}

function group(entries: PEntry[]): Section[] {
  const out: Section[] = [];
  let cur: Section | null = null;
  const open = (title: string): void => {
    cur = { title, entries: [] };
    out.push(cur);
  };
  for (const e of entries) {
    if (e.type === 'wake' || e.type === 'sleep' || e.type === 'prayer' || e.type === 'qaylulah') {
      open(sectionTitle(e));
      cur!.entries.push(e);
    } else {
      if (!cur) open('День');
      cur!.entries.push(e);
    }
  }
  return out;
}

function nearestIdx(start: number, starts: number[]): number {
  let best = 0;
  for (let i = 0; i < starts.length; i++) {
    if (Math.abs(starts[i] - start) < Math.abs(starts[best] - start)) best = i;
  }
  return best;
}

// Сессия перетаскивания живёт на уровне модуля: пересборка плана во время драга
// перемонтирует строку, но сессия и слушатели не зависят от React.
let qDragSession: { y: number; base: number; last: number } | null = null;
let qDragRowH = 48;
let qDragStarts: number[] = [];
let qDragOnMove: ((start: number) => void) | null = null;
let qDragLastY = 0;

function qDragPointer(): void {
  if (!qDragSession || !qDragOnMove || qDragStarts.length === 0) return;
  const s = qDragSession;
  const idx = Math.max(0, Math.min(qDragStarts.length - 1, s.base + Math.round((qDragLastY - s.y) / qDragRowH)));
  if (idx === s.last) return;
  s.last = idx;
  qDragOnMove(qDragStarts[idx]);
}

function qDragHandleMove(ev: PointerEvent): void {
  if (!qDragSession) return;
  qDragLastY = ev.clientY;
  qDragPointer();
}

function qDragHandleEnd(): void {
  qDragSession = null;
  qDragOnMove = null;
  document.body.style.userSelect = '';
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', qDragHandleMove);
  window.addEventListener('pointerup', qDragHandleEnd);
  window.addEventListener('pointercancel', qDragHandleEnd);
}

function QaylulahRow({
  e,
  starts,
  currentStart,
  onMove
}: {
  e: PEntry;
  starts: number[];
  currentStart: number;
  onMove: (start: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const past = parseHHMM(e.time) <= parseHHMM(nowHHMM());

  function down(ev: React.PointerEvent<HTMLDivElement>): void {
    ev.preventDefault();
    qDragRowH = ref.current?.offsetHeight || 48;
    qDragStarts = starts;
    qDragOnMove = onMove;
    qDragLastY = ev.clientY;
    qDragSession = { y: ev.clientY, base: nearestIdx(currentStart, starts), last: nearestIdx(currentStart, starts) };
    setDragging(true);
    document.body.style.userSelect = 'none';
  }

  return (
    <div
      ref={ref}
      className={`entry type-${e.type} qaylulah-drag${dragging ? ' dragging' : ''}`}
      style={{ opacity: past ? 0.55 : 1 }}
      onPointerDown={down}
    >
      <div className="etime">{e.end ? `${e.time} — ${e.end}` : e.time}</div>
      <div className="edot" style={{ background: DOT[e.type] ?? '#94a3b8' }} />
      <div className="ebody">
        <div className="etitle">
          <span className="qaylulah-grip">⠿</span> {e.title}
        </div>
        <div className="etext">{e.text}</div>
      </div>
    </div>
  );
}

function EntryRow({ e }: { e: PEntry }) {
  const [open, setOpen] = useState(false);
  const past = parseHHMM(e.time) <= parseHHMM(nowHHMM());
  return (
    <div className={`entry type-${e.type}`} style={{ opacity: past ? 0.55 : 1 }}>
      <div className="etime">{e.end ? `${e.time} — ${e.end}` : e.time}</div>
      <div className="edot" style={{ background: DOT[e.type] ?? '#94a3b8' }} />
      <div className="ebody">
        <div className="etitle">{e.title}</div>
        <button
          className="alarm-toggle"
          onClick={() => setOpen((v) => !v)}
          style={{ display: e.text || e.desc ? undefined : 'none' }}
        >
          {open ? 'Свернуть' : 'Подробнее'}
        </button>
        {open && (
          <>
            {e.text && <div className="etext">{e.text}</div>}
            {e.desc && <div className="etext">{e.desc}</div>}
          </>
        )}
      </div>
    </div>
  );
}

export default function Schedule({ state, setBusy }: Props) {
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [reg, setReg] = useState<RegisterResult | null>(null);
  const [soundMsg, setSoundMsg] = useState('');

  const pt = state.prayer?.prayers ?? null;

  const [q, setQ] = useState<Qaylulah>(() => ({ ...state.settings.qaylulah }));
  const starts = (q.enabled ? qayluAllowedStarts(q.minutes, pt) : null) ?? [];
  const curStart = ((): number => {
    if (q.start && q.start.trim().length > 0) return parseHHMM(q.start);
    return qayluAutoStart(q.minutes, pt) ?? 0;
  })();

  async function refreshPlanLight(): Promise<void> {
    try {
      const p = await window.api.getPlan();
      if (p) setPlan(p);
    } catch {
      /* ignore */
    }
  }

  const applyQnext = useCallback(async (next: Qaylulah): Promise<void> => {
    setQ(next);
    try {
      await window.api.setSettings({ qaylulah: next });
    } catch {
      /* настройки всё равно сохраняются в main */
    }
    await refreshPlanLight();
  }, []);

  function changeMinutes(minutes: number): void {
    const nextStarts = qayluAllowedStarts(minutes, pt) ?? [];
    let start = q.start;
    if (!q.start || q.start.trim().length === 0) {
      start = qayluAutoStart(minutes, pt) !== null ? toHHMM(qayluAutoStart(minutes, pt)!) : '';
    } else {
      const cur = parseHHMM(q.start);
      if (nextStarts.length === 0) start = '';
      else if (nextStarts.indexOf(cur) >= 0) start = q.start;
      else start = toHHMM(nextStarts[nearestIdx(cur, nextStarts)]);
    }
    void applyQnext({ ...q, minutes, start });
  }

  async function soundTest(): Promise<void> {
    setSoundMsg('Проверяю…');
    try {
      await window.api.testAlarm();
      setSoundMsg('Открыл окно проверки. Если звука нет — нажмите внутри окна.');
    } catch (e) {
      setSoundMsg(`Ошибка: ${String(e)}`);
    }
    setTimeout(() => setSoundMsg(''), 6000);
  }

  async function build(refetch: boolean): Promise<void> {
    setLoading(true);
    setErr('');
    setBusy(true);
    try {
      if (refetch) await window.api.refreshPrayers();
      setPlan(await window.api.buildSchedule());
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }

  useEffect(() => {
    void build(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function register(): Promise<void> {
    setBusy(true);
    setErr('');
    try {
      setReg(await window.api.registerAlarms());
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !plan) {
    return (
      <div className="boot">
        <div className="spinner" />
        <p>Собираю расписание…</p>
      </div>
    );
  }

  if (err) {
    return (
      <div>
        <div className="errbox">{err}</div>
        <div className="panel">
          <div className="row">
            <button className="btn" onClick={() => void build(true)}>
              Скачать времена намазов
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div>
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Расписание на {formatDateRu(plan.date)}</h2>
            <p className="sub" style={{ margin: 0 }}>
              {plan.cityName} · времена намазов от {plan.sourceDate}
              {plan.fromCache && (
                <span
                  className="badge off"
                  style={{ marginLeft: 8 }}
                  title={`Времена взяты из сохранённого кэша (действительны только на ${plan.sourceDate}) — свежие намазы с namaztimes.kz не загрузились. Проверьте интернет и нажмите «Обновить намазы».`}
                >
                  кэш · сеть недоступна
                </span>
              )}
            </p>
          </div>
          <div className="row">
            <button className="btn ghost" onClick={() => void build(false)}>
              Пересобрать
            </button>
            <button className="btn ghost" onClick={() => void build(true)}>
              Обновить намазы
            </button>
            <button className="btn" onClick={() => void register()}>
              {state.settings.useTaskScheduler ? 'Зарегистрировать будильники' : 'Включить на сегодня'}
            </button>
            <button className="btn ghost" onClick={() => void soundTest()}>
              Проверить звук
            </button>
            {soundMsg && <span className="hint">{soundMsg}</span>}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Къайлюля (полуденный отдых)</h2>
            <p className="sub" style={{ margin: 0 }}>
              От ~часа до Зухра и до Магриба, не поверх намазов. После перемещения нажмите
              «Зарегистрировать будильники», чтобы обновить будильники.
            </p>
          </div>
          <label className="small">
            <input type="checkbox" checked={q.enabled} onChange={(e) => void applyQnext({ ...q, enabled: e.target.checked })} /> На день
          </label>
        </div>
        {q.enabled && (
          <>
            <div className="row" style={{ gap: 22, marginTop: 8, flexWrap: 'wrap' }}>
              <label className="small">
                Длительность
                <select value={q.minutes} onChange={(e) => changeMinutes(Number(e.target.value))}>
                  {[40, 45, 50, 55, 60].map((m) => (
                    <option key={m} value={m}>
                      {m} мин
                    </option>
                  ))}
                </select>
              </label>
              <span className="hint">
                Сейчас: <b>{toHHMM(curStart)} — {toHHMM(curStart + q.minutes)}</b>. Тяните блок «Къайлюля» в списке
                вверх/вниз — можно ставить в пределах: {qayluRangesLabel(q.minutes, pt) ?? 'нет места'}
              </span>
            </div>
          </>
        )}
      </div>

      {reg && (
        <div className="panel">
          <p className="sub" style={{ margin: 0 }}>
            {state.settings.useTaskScheduler
              ? `Зарегистрировано одноразовых будильников: ${reg.registered} (активных задач Windows: ${reg.taskNames.length}).`
              : 'Будильники будут срабатывать, пока приложение открыто (режим трея).'}
          </p>
        </div>
      )}

      {plan.warnings.length > 0 && (
        <div className="warnbox">
          <b>Примечания</b>
          <ul>
            {plan.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="prayerheader">
        {plan.entries
          .filter((e) => e.type === 'prayer')
          .map((e, i) => (
            <span className="prayerchip" key={i}>
              <b>{e.title}</b> {e.time}
            </span>
          ))}
      </div>

      {group(plan.entries).map((s, si) => (
        <div key={si}>
          <div className="windowhead">{s.title}</div>
          {s.entries.map((e) =>
            e.type === 'qaylulah' && starts.length > 0 ? (
              <QaylulahRow
                key="qaylulah"
                e={e}
                starts={starts}
                currentStart={curStart}
                onMove={(start) => void applyQnext({ ...q, start: toHHMM(start) })}
              />
            ) : (
              <EntryRow key={`${e.time}/${e.title}`} e={e} />
            )
          )}
        </div>
      ))}
    </div>
  );
}