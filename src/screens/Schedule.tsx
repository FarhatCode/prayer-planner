import { useEffect, useState } from 'react';
import type { DayPlan, PEntry, RegisterResult, UpdateState } from '../../shared/types';
import { formatDateRu, nowHHMM, parseHHMM } from '../lib/fmt';

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
  sleep: '#334155'
};

function group(entries: PEntry[]): Section[] {
  const out: Section[] = [];
  let cur: Section | null = null;
  const open = (title: string): void => {
    cur = { title, entries: [] };
    out.push(cur);
  };
  for (const e of entries) {
    if (e.type === 'wake') {
      open(`Подъем · ${e.time}`);
      cur!.entries.push(e);
    } else if (e.type === 'sleep') {
      open(`Отбой · ${e.time}`);
      cur!.entries.push(e);
    } else if (e.type === 'prayer') {
      open(`${e.title} · ${e.time}`);
      cur!.entries.push(e);
    } else {
      if (!cur) open('День');
      cur!.entries.push(e);
    }
  }
  return out;
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

      {group(plan.entries).map((s, i) => (
        <div key={i}>
          <div className="windowhead">{s.title}</div>
          {s.entries.map((e, j) => (
            <EntryRow key={j} e={e} />
          ))}
        </div>
      ))}
    </div>
  );
}