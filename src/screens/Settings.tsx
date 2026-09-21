import { useState } from 'react';
import type { PrayerFetchResult, Qaylulah, Settings, UpdateState } from '../../shared/types';
import { SHORT_LABELS } from '../../shared/types';
import CityPicker from '../components/CityPicker';
import { qayluStartValid, qayluRangesLabel, qayluClampMinutes } from '../lib/qaylulah';

interface Props {
  state: UpdateState;
  onSaved: () => void;
}

const PRAYER_ROWS: Array<[string, string]> = [
  ['Фаджр', 'bamdat'],
  ['Восход', 'kun'],
  ['Зухр', 'besin'],
  ['Аср', 'ekindi'],
  ['Магриб', 'aqsham'],
  ['Иша', 'quptan']
];

export default function Settings({ state, onSaved }: Props) {
  const [form, setForm] = useState<Settings>(() => JSON.parse(JSON.stringify(state.settings)));
  const [preview, setPreview] = useState<PrayerFetchResult | null>(state.prayer);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [soundMsg, setSoundMsg] = useState('');

  async function testSound(): Promise<void> {
    setSoundMsg('Проверяю…');
    try {
      await window.api.testAlarm();
      setSoundMsg('Открыл окно проверки. Если звука нет — нажмите внутри окна.');
    } catch (e) {
      setSoundMsg(`Ошибка: ${String(e)}`);
    }
    setTimeout(() => setSoundMsg(''), 6000);
  }

  function set<K extends keyof Settings>(k: K, v: Settings[K]): void {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function refresh(): Promise<void> {
    setMsg('');
    try {
      const res = await window.api.refreshPrayers();
      setPreview(res);
      if (res.ok && res.attributes && res.attributes.CityName) {
        const attrs = res.attributes;
        setForm((f) => ({ ...f, cityId: Number(attrs.ID), cityName: attrs.CityName }));
      }
      setMsg(
        res.ok
          ? res.offline
            ? `Времена из кэша (${res.sourceDate}) - сеть недоступна, кэш действителен только на эту дату.`
            : `Времена обновлены: ${res.sourceDate}.`
          : `Ошибка: ${res.error}`
      );
    } catch (e) {
      setMsg(String(e));
    }
  }

  async function save(): Promise<void> {
    setSaving(true);
    setMsg('');
    try {
      const q = form.qaylulah;
      if (q.enabled) {
        const pt = preview?.prayers ?? state.prayer?.prayers ?? null;
        const v = qayluStartValid(q.start, q.minutes, pt);
        if (!v.ok) {
          setMsg(`Къайлюля: ${v.error}`);
          return;
        }
      }
      const next: Settings = {
        ...form,
        cityId: Number(form.cityId) || 0,
        slotMin: Math.max(10, Number(form.slotMin) || 45),
        breakMin: Math.min(15, Math.max(0, Number(form.breakMin) || 15)),
        wake: form.wake || '04:30',
        sleep: form.sleep || '00:00',
        volume: Math.max(0, Math.min(1, Number(form.volume) || 1)),
        qaylulah: { ...q, minutes: qayluClampMinutes(q.minutes), enabled: q.enabled }
      };
      await window.api.setSettings(next);
      setForm(next);
      setMsg('Настройки сохранены.');
      onSaved();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setSaving(false);
    }
  }

  function setQaylulah(patch: Partial<Qaylulah>): void {
    setForm((f) => ({ ...f, qaylulah: { ...f.qaylulah, ...patch } }));
  }

  return (
    <div>
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2>Город и намазы</h2>
            <p className="sub">Список городов берётся из namaztimes.kz и кэшируется для офлайна.</p>
          </div>
          <div className="row">
            <button className="btn ghost" onClick={() => void refresh()}>
              Обновить времена
            </button>
            <button className="btn ghost" onClick={() => void testSound()}>
              Проверить звук
            </button>
            {soundMsg && <span className="hint">{soundMsg}</span>}
            <button className="btn" onClick={() => void save()} disabled={saving}>
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Поиск города</h2>
        <CityPicker
          selectedId={form.cityId}
          selectedName={form.cityName}
          onSelect={(id, name) => setForm((f) => ({ ...f, cityId: id, cityName: name }))}
        />
        {preview && preview.prayers && (
          <div style={{ marginTop: 8 }}>
            <table className="praytable">
              <tbody>
                {PRAYER_ROWS.map(([label, key]) => (
                  <tr key={key}>
                    <td>{label}</td>
                    <td>{preview.prayers?.[key as keyof typeof preview.prayers] || '—'}</td>
                  </tr>
                ))}
                {preview.attributes?.QiblaDir && (
                  <tr>
                    <td>Кибла</td>
                    <td>{preview.attributes.QiblaDir}°</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {msg && <p className="hint" style={{ marginTop: 8 }}>{msg}</p>}
      </div>

      <div className="panel">
        <h2>Распорядок</h2>
        <div className="settingsgrid">
          <div className="field">
            <label>Подъем (HH:MM)</label>
            <input type="time" value={form.wake} onChange={(e) => set('wake', e.target.value)} />
          </div>
          <div className="field">
            <label>Отбой (00:00 = конец дня)</label>
            <input type="time" value={form.sleep} onChange={(e) => set('sleep', e.target.value)} />
          </div>
          <div className="field">
            <label>Слот учебы, мин (не ужимается)</label>
            <input type="number" min={10} step={5} value={form.slotMin} onChange={(e) => set('slotMin', Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Перерыв, мин (минимум; сжимается при нехватке места)</label>
            <input type="number" min={0} max={15} step={1} value={form.breakMin} onChange={(e) => set('breakMin', Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Громкость звука: {Math.round(form.volume * 100)}%</label>
            <input type="range" className="slider" min={0} max={1} step={0.05} value={form.volume} onChange={(e) => set('volume', Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Окна между намазами</h2>
        <p className="sub">
          Рабочий диапазон окна = (следующий намаз − пад после) − (этот намаз + пад перед). В конце окна при запасе
          ставится отдых, при paд перед намазом — подготовка.
        </p>
        {form.windows.map((w, i) => (
          <div className="winrow" key={i}>
            <b style={{ minWidth: 150 }}>
              {SHORT_LABELS[w.from] ?? w.from} → {SHORT_LABELS[w.to] ?? w.to}
            </b>
            <input
              type="number"
              min={0}
              step={5}
              style={{ width: 80 }}
              title="Пад перед (мин после начала намаза)"
              value={w.startPadMin}
              onChange={(e) => {
                const windows = [...form.windows];
                windows[i] = { ...windows[i], startPadMin: Number(e.target.value) };
                set('windows', windows);
              }}
            />
            <span className="hint">пад перед</span>
            <input
              type="number"
              min={0}
              step={5}
              style={{ width: 80 }}
              title="Пад после (мин до следующего намаза)"
              value={w.endPadMin}
              onChange={(e) => {
                const windows = [...form.windows];
                windows[i] = { ...windows[i], endPadMin: Number(e.target.value) };
                set('windows', windows);
              }}
            />
            <span className="hint">пад после</span>
            <input
              type="text"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="Текст отдыха"
              value={w.restLabel}
              onChange={(e) => {
                const windows = [...form.windows];
                windows[i] = { ...windows[i], restLabel: e.target.value };
                set('windows', windows);
              }}
            />
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Къайлюля (полуденный отдых)</h2>
        <p className="sub">
          Сунна полуденного сна/отдыха. Разрешённое место — от ~часа до Зухра и до Магриба (утро не подходит), блок
          никогда не встаёт поверх намаза. Допустимые диапазоны начала (ЧЧ:ММ):
        </p>
        <div className="row" style={{ gap: 22, flexWrap: 'wrap' }}>
          <label className="small">
            <input
              type="checkbox"
              checked={form.qaylulah.enabled}
              onChange={(e) => setQaylulah({ enabled: e.target.checked })}
            />
            Включить къайлюлю
          </label>
          <label className="small">
            Длительность
            <select value={form.qaylulah.minutes} onChange={(e) => setQaylulah({ minutes: Number(e.target.value) })}>
              {[40, 45, 50, 55, 60].map((m) => (
                <option key={m} value={m}>
                  {m} мин
                </option>
              ))}
            </select>
          </label>
        </div>
        {form.qaylulah.enabled && (
          <>
            <div className="settingsgrid" style={{ marginTop: 8 }}>
              <div className="field">
                <label>Начало (ЧЧ:ММ; пусто = сразу после Зухра)</label>
                <input
                  type="text"
                  placeholder={'Например 12:00'}
                  value={form.qaylulah.start}
                  onChange={(e) => setQaylulah({ start: e.target.value })}
                />
              </div>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              Можно ставить только: {qayluRangesLabel(form.qaylulah.minutes, preview?.prayers ?? state.prayer?.prayers ?? null) ?? 'нет времён намазов — обновите намазы'}
            </p>
          </>
        )}
      </div>

      <div className="panel">
        <h2>Уведомления</h2>
        <div className="row" style={{ gap: 22 }}>
          <label className="small">
            <input
              type="checkbox"
              checked={form.useTaskScheduler}
              onChange={(e) => set('useTaskScheduler', e.target.checked)}
            />
            Будильники через Windows Task Scheduler (звонят, даже когда приложение закрыто)
          </label>
          <label className="small">
            <input
              type="checkbox"
              checked={form.closeToTray}
              onChange={(e) => set('closeToTray', e.target.checked)}
            />
            При закрытии сворачивать в трей
          </label>
          <label className="small">
            <input
              type="checkbox"
              checked={form.autoLaunch}
              onChange={(e) => set('autoLaunch', e.target.checked)}
            />
            Запускать при входе в Windows
          </label>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          Если Task Scheduler выключен — будильники срабатывают, только пока приложение запущено в трее.
        </p>
      </div>
    </div>
  );
}