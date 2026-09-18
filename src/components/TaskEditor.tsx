import { useState } from 'react';
import type { Task } from '../../shared/types';

interface Props {
  task: Task;
  windowNames: string[];
  onChange: (next: Task) => void;
  onDelete: () => void;
}

const COLORS = ['#4c86f5', '#9b6cf0', '#2bb391', '#f5a623', '#f472b6', '#34d399', '#f87171', '#38bdf8'];

export default function TaskEditor({ task, windowNames, onChange, onDelete }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="taskcard" style={{ borderLeft: `4px solid ${task.color || '#4c86f5'}` }}>
      <div className="taskrow">
        <button
          className="btn ghost"
          style={{ padding: '4px 8px' }}
          onClick={() => setOpen((v) => !v)}
          title={open ? 'Скрыть описание' : 'Показать описание'}
        >
          {open ? '▾' : '▸'}
        </button>
        <div className="taskcol">
          <input
            type="text"
            value={task.name}
            placeholder="Название предмета / задачи"
            onChange={(e) => onChange({ ...task, name: e.target.value })}
          />
          <span className="hint">
            {Number(task.hours * 60) >= 45
              ? `${Math.floor((task.hours * 60) / 45)} полных слотов по 45 мин`
              : 'один короткий слот'}
          </span>
        </div>
        <input
          type="number"
          min={0.5}
          step={0.5}
          value={task.hours}
          style={{ width: 76 }}
          onChange={(e) => onChange({ ...task, hours: Math.max(0.5, Number(e.target.value) || 0.5) })}
          title="Часы на день"
        />
        <select
          value={task.pinnedWindow ?? ''}
          onChange={(e) =>
            onChange({ ...task, pinnedWindow: e.target.value === '' ? undefined : Number(e.target.value) })
          }
          title="Закрепить в окне (иначе авто)"
        >
          <option value="">окно: авто</option>
          {windowNames.map((n, i) => (
            <option key={i} value={i}>
              {n}
            </option>
          ))}
        </select>
        <label className="small" title="Можно переносить в другое окно при нехватке места">
          <input
            type="checkbox"
            checked={task.canMove}
            onChange={(e) => onChange({ ...task, canMove: e.target.checked })}
          />
          переносить
        </label>
        <div className="row" style={{ gap: 4 }}>
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ ...task, color: c })}
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                background: c,
                border: task.color === c ? '2px solid #fff' : '2px solid transparent',
                cursor: 'pointer',
                padding: 0
              }}
              title={c}
            />
          ))}
        </div>
        <button className="btn danger" onClick={onDelete}>
          Удалить
        </button>
      </div>

      {open && (
        <div className="taskexpanded">
          <textarea
            rows={3}
            value={task.desc}
            placeholder="Описание задачи (показывается в уведомлении слота)"
            onChange={(e) => onChange({ ...task, desc: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}