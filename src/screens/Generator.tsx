import { useState } from 'react';
import type { Task, UpdateState } from '../../shared/types';
import { SHORT_LABELS } from '../../shared/types';
import TaskEditor from '../components/TaskEditor';
import { uid } from '../lib/fmt';

interface Props {
  state: UpdateState;
  onSaved: () => void;
}

export default function Generator({ state, onSaved }: Props) {
  const [tasks, setTasks] = useState<Task[]>(() => state.tasks.map((t) => ({ ...t, pinnedWindow: t.pinnedWindow })));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const windowNames = state.settings.windows.map(
    (w) => `${SHORT_LABELS[w.from] ?? w.from} → ${SHORT_LABELS[w.to] ?? w.to}`
  );

  const activeTasks = tasks.filter((t) => t.active !== false);
  const totalHours = activeTasks.reduce((s, t) => s + t.hours, 0);
  const totalMinutes = activeTasks.reduce((s, t) => s + Math.max(1, Math.round(t.hours * 60)), 0);
  const inactiveCount = tasks.length - activeTasks.length;

  const update = (i: number, next: Task) => setTasks((ts) => ts.map((t, j) => (j === i ? next : t)));
  const remove = (i: number) => setTasks((ts) => ts.filter((_, j) => j !== i));

  const add = () =>
    setTasks((ts) => [
      ...ts,
      { id: uid(), name: '', hours: 1, desc: '', color: '#4c86f5', canMove: true, pinnedWindow: undefined }
    ]);

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      const cleaned = tasks.map((t) => ({
        ...t,
        name: t.name.trim() || 'Без названия',
        hours: Math.max(0.5, t.hours),
        pinnedWindow: t.pinnedWindow ?? undefined
      }));
      await window.api.setTasks(cleaned);
      setMsg('Сохранено.');
      onSaved();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="panel">
        <h2>Задачи и часы</h2>
        <p className="sub">
          Каждая задача режется на слоты по {state.settings.slotMin} мин с перерывами между ними. Всего: {totalHours} ч
          ({totalMinutes} мин). Слоты учебы никогда не ужимаются — при нехватке места сначала сокращаются перерывы.
          {inactiveCount > 0 && <span className="hint"> Неактивные ({inactiveCount}) в план не попадают.</span>}
        </p>
        <div className="row">
          <button className="btn" onClick={add}>
            + Добавить задачу
          </button>
          <button className="btn ghost" onClick={save} disabled={saving || tasks.length === 0}>
            {saving ? 'Сохраняю…' : 'Сохранить задачи'}
          </button>
          {msg && <span className="hint">{msg}</span>}
        </div>
      </div>

      {tasks.length === 0 && (
        <div className="panel">
          <p className="hint">Список пуст. Добавьте задачи, чтобы построить расписание.</p>
        </div>
      )}

      {tasks.map((t, i) => (
        <TaskEditor key={t.id} task={t} windowNames={windowNames} onChange={(n) => update(i, n)} onDelete={() => remove(i)} />
      ))}
    </div>
  );
}