import type {
  AnchorKey,
  DayPlan,
  PEntry,
  PlanWindow,
  PrayerCache,
  Settings,
  Task
} from '../../shared/types';
import { SHORT_LABELS } from '../../shared/types';
import { parseHHMM, toHHMM, todayStr } from './fmt';
import { anchorPrayerKey } from './prayerTimes';

export const BLOCK_LABELS: Record<AnchorKey, string> = {
  wake: 'Подъем',
  fajr: 'Фаджр',
  dhuhr: 'Зухр',
  asr: 'Аср',
  maghrib: 'Магриб',
  isha: 'Иша',
  sleep: 'Отбой'
};

interface Slot {
  dur: number;
}

interface PreparedTask {
  task: Task;
  minutes: number;
  slots: Slot[];
  pinned: number | null;
}

export interface BuildInput {
  settings: Settings;
  tasks: Task[];
  prayers: PrayerCache;
  date?: string;
}

export function buildDayPlan(input: BuildInput): DayPlan {
  const { settings, tasks, prayers } = input;
  const prayersValid =
    prayers &&
    prayers.praytimes &&
    typeof prayers.praytimes.bamdat === 'string' &&
    prayers.praytimes.bamdat.length > 0;
  if (!prayersValid) throw new Error('Нет времен намазов — обновите данные (нужен интернет или кэш).');

  const anchors = anchorsOf(settings, prayers);
  const slotMin = Math.max(1, settings.slotMin);
  const breakMin = Math.max(0, Math.min(15, settings.breakMin));

  const windows = settings.windows;
  const W = windows.map((w) => {
    const a = anchors[w.from];
    const b = anchors[w.to];
    const workA = a + w.startPadMin;
    const workB = b - w.endPadMin;
    return { w, a, b, workA, workB, work: workB - workA };
  });

  const usable: number[] = [];
  const warnings: string[] = [];
  W.forEach((win, idx) => {
    if (win.work > 0) usable.push(idx);
  });
  W.forEach((win, idx) => {
    if (win.work <= 0) {
      warnings.push(
        `Окно «${winLabel(win.w)}» непригодно: промежуток меньше падов (work=${win.work} мин). Задачи из него не размещаются.`
      );
    }
  });

  const prepared: PreparedTask[] = tasks.map((task) =>
    prepareTask(task, slotMin, windows.length)
  );

  const assigned: PreparedTask[][] = windows.map(() => []);
  const breaksUsed: number[] = windows.map(() => 0);

  function need(T: PreparedTask[], b: number): number {
    if (T.length === 0) return 0;
    let sum = 0;
    let slots = 0;
    for (const t of T) {
      sum += t.minutes;
      slots += t.slots.length;
    }
    return sum + b * Math.max(0, slots - 1);
  }

  function bestBreak(winIdx: number, T: PreparedTask[]): number | null {
    const work = W[winIdx].work;
    for (let b = 15; b >= breakMin; b--) {
      if (need(T, b) <= work) return b;
    }
    return null;
  }

  function slackAt15(winIdx: number, T: PreparedTask[]): number {
    return W[winIdx].work - need(T, 15);
  }

  // 1) initial placement
  for (const t of prepared) {
    if (t.pinned !== null && usable.includes(t.pinned)) {
      assigned[t.pinned].push(t);
      continue;
    }
    let placed = false;
    for (const idx of usable) {
      if (t.pinned === null && need([...assigned[idx], t], 15) <= W[idx].work) {
        assigned[idx].push(t);
        placed = true;
        break;
      }
    }
    if (!placed) {
      let best = -1;
      let bestSlack = -Infinity;
      for (const idx of usable) {
        const s = slackAt15(idx, assigned[idx]);
        if (s > bestSlack) {
          bestSlack = s;
          best = idx;
        }
      }
      if (best >= 0) assigned[best].push(t);
      else warnings.push(`Задача «${t.task.name}» не размещена: нет ни одного пригодного окна.`);
    }
  }

  // 2) stabilization: move movable tasks out of overflowing windows
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (const idx of usable) {
      const b = bestBreak(idx, assigned[idx]);
      if (b !== null) {
        breaksUsed[idx] = b;
        continue;
      }
      // window overflows: try to relocate movable unpinned tasks
      const movable = assigned[idx]
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t.pinned === null)
        .reverse();
      for (const { t } of movable) {
        let moved = false;
        const cands = usable
          .filter((c) => c !== idx)
          .sort((x, y) => slackAt15(y, assigned[y]) - slackAt15(x, assigned[x]));
        for (const cand of cands) {
          const nb = bestBreak(cand, [...assigned[cand], t]);
          if (nb !== null) {
            assigned[idx] = assigned[idx].filter((x) => x !== t);
            assigned[cand].push(t);
            breaksUsed[cand] = nb;
            moved = true;
            changed = true;
            break;
          }
        }
        if (moved) break;
      }
    }
    if (!changed) break;
  }

  // 3) drop leftovers so that nothing silently overruns a window
  for (const idx of usable) {
    let b = bestBreak(idx, assigned[idx]);
    if (b === null) {
      const dropped: string[] = [];
      const removable = assigned[idx].filter((t) => t.pinned === null);
      for (const t of removable) {
        if (b !== null) break;
        if (!t.task.canMove) continue;
        assigned[idx] = assigned[idx].filter((x) => x !== t);
        dropped.push(t.task.name);
        b = bestBreak(idx, assigned[idx]);
      }
      if (b === null) {
        while (assigned[idx].length > 0 && bestBreak(idx, assigned[idx]) === null) {
          const last = assigned[idx].pop();
          if (last) dropped.push(last.task.name);
        }
        b = bestBreak(idx, assigned[idx]);
      }
      if (dropped.length > 0) {
        warnings.push(
          `Не поместились: ${dropped.join(', ')}. Увеличьте промежуток окна или уменьшите часы.`
        );
      }
    }
    breaksUsed[idx] = b === null ? 0 : b;
  }

  // 4) layout entries
  const entries: PEntry[] = [];

  entries.push({
    time: toHHMM(anchors.wake),
    type: 'wake',
    title: SHORT_LABELS.wake,
    text: '',
    desc: ''
  });

  const flatWindows: (PlanWindow | null)[] = windows.map(() => null);

  for (const idx of usable) {
    const win = W[idx];
    const w = win.w;
    const name = winLabel(w);
    const b = breaksUsed[idx];
    flatWindows[idx] = {
      name,
      from: w.from,
      to: w.to,
      startPadMin: w.startPadMin,
      endPadMin: w.endPadMin,
      restLabel: w.restLabel,
      breakUsed: b,
      entriesCount: 0
    };

    // prayer at the start anchor of the window
    const pk = anchorPrayerKey(w.from);
    if (pk) {
      entries.push({
        time: toHHMM(win.a),
        end: toHHMM(win.b),
        type: 'prayer',
        title: SHORT_LABELS[w.from] ?? BLOCK_LABELS[w.from],
        text: `${SHORT_LABELS[w.from] ?? BLOCK_LABELS[w.from]} · ${toHHMM(win.a)}`,
        desc: ''
      });
    }

    if (b <= 0) continue;
    let cursor = win.workA;

    // flatten (task, slot) in assignment order
    const flat: Array<{ t: PreparedTask; i: number; dur: number }> = [];
    for (const t of assigned[idx]) {
      for (let i = 0; i < t.slots.length; i++) flat.push({ t, i, dur: t.slots[i].dur });
    }

    for (let i = 0; i < flat.length; i++) {
      const item = flat[i];
      entries.push({
        time: toHHMM(cursor),
        end: toHHMM(cursor + item.dur),
        type: 'study',
        taskId: item.t.task.id,
        title:
          item.t.task.name + (flat.length > 1 && item.t.slots.length > 1 ? ` · Часть ${item.i + 1}/${item.t.slots.length}` : ''),
        text: item.t.task.desc || `${item.t.task.name} — занятие`,
        desc: ''
      });
      cursor += item.dur;
      if (i < flat.length - 1) {
        entries.push({
          time: toHHMM(cursor),
          end: toHHMM(cursor + b),
          type: 'break',
          title: `Перерыв ${b} мин`,
          text: '',
          desc: ''
        });
        cursor += b;
      }
    }

    const leftover = win.workB - cursor;
    if (leftover > 0) {
      entries.push({
        time: toHHMM(cursor),
        end: toHHMM(win.workB),
        type: 'rest',
        title: w.restLabel,
        text: w.restLabel,
        desc: ''
      });
    }
    if (w.endPadMin > 0) {
      entries.push({
        time: toHHMM(win.workB),
        end: toHHMM(win.b),
        type: 'prep',
        title: `Подготовка к ${SHORT_LABELS[w.to] ?? BLOCK_LABELS[w.to]}`,
        text: `Приготовления к ${SHORT_LABELS[w.to] ?? BLOCK_LABELS[w.to]}`,
        desc: ''
      });
    }
  }

  entries.push({
    time: anchors.sleep === 1440 ? '24:00' : toHHMM(anchors.sleep),
    type: 'sleep',
    title: SHORT_LABELS.sleep,
    text: '',
    desc: ''
  });

  // 5) stable sort + dedupe
  const MINP = (e: PEntry) => parseHHMM(e.time);
  entries.sort((a, b) => {
    const d = MINP(a) - MINP(b);
    if (d !== 0) return d;
    const order: Record<PEntry['type'], number> = { wake: 0, prayer: 1, study: 2, break: 3, rest: 4, prep: 5, sleep: 6 };
    return (order[a.type] ?? 7) - (order[b.type] ?? 7);
  });
  const seen = new Map<number, PEntry>();
  for (const e of entries) {
    const min = MINP(e);
    if (!seen.has(min)) seen.set(min, e);
  }
  const finalEntries = [...seen.values()];

  // 6) remaining-tasks info for breaks (любой ещё не прошедший слот задачи)
  const durations: Record<string, number[]> = {};
  for (const t of prepared) durations[t.task.id] = t.slots.map((s) => s.dur);
  const done: Record<string, number> = {};
  for (const e of finalEntries) {
    if (e.type === 'study' && e.taskId) {
      done[e.taskId] = (done[e.taskId] ?? 0) + 1;
      continue;
    }
    if (e.type !== 'break') continue;
    const m = MINP(e);
    const rem: Record<string, number> = {};
    for (const id of Object.keys(durations)) {
      const idx = done[id] ?? 0;
      let left = 0;
      for (let i = idx; i < durations[id].length; i++) left += durations[id][i];
      if (left > 0) rem[id] = left;
    }
    if (Object.keys(rem).length > 0) {
      e.remaining = rem;
      const lines = Object.entries(rem)
        .map(([id, mins]) => {
          const name = tasks.find((x) => x.id === id)?.name ?? id;
          return `• ${name} — ${minsLabel(mins)}`;
        })
        .join('\n');
      e.text = `Осталось по плану:\n${lines}`;
    }
  }

  // window entry counts
  for (const e of finalEntries) {
    if (e.type === 'wake' || e.type === 'sleep') continue;
    const m = MINP(e);
    for (const idx of usable) {
      if (m >= W[idx].workA && m < W[idx].workB) {
        if (flatWindows[idx]) flatWindows[idx].entriesCount++;
        break;
      }
    }
  }

  if (warnings.length === 0) warnings.push('Все задачи размещены. Расписание оптимально.');

  return {
    date: input.date ?? todayStr(),
    sourceDate: prayers.date,
    fromCache: false,
    cityId: settings.cityId,
    cityName: settings.cityName,
    windows: flatWindows.filter((x): x is PlanWindow => x !== null),
    entries: finalEntries,
    warnings
  };
}

function anchorsOf(settings: Settings, prayers: PrayerCache): Record<AnchorKey, number> {
  const a: Record<AnchorKey, number> = {
    wake: parseHHMM(settings.wake),
    fajr: parseHHMM(prayers.praytimes.bamdat),
    dhuhr: parseHHMM(prayers.praytimes.besin),
    asr: parseHHMM(prayers.praytimes.ekindi),
    maghrib: parseHHMM(prayers.praytimes.aqsham),
    isha: parseHHMM(prayers.praytimes.quptan),
    sleep: settings.sleep === '00:00' ? 1440 : parseHHMM(settings.sleep)
  };
  return a;
}

function prepareTask(task: Task, slotMin: number, winCount: number): PreparedTask {
  const minutes = Math.max(1, Math.round(task.hours * 60));
  const slots: Slot[] = [];
  let rem = minutes;
  while (rem > 0) {
    const d = Math.min(slotMin, rem);
    slots.push({ dur: d });
    rem -= d;
  }
  const pinned =
    task.pinnedWindow !== undefined && task.pinnedWindow !== null && Number.isInteger(task.pinnedWindow)
      ? Math.min(Math.max(0, task.pinnedWindow), winCount - 1)
      : null;
  return { task, minutes, slots, pinned };
}

function winLabel(w: { from: AnchorKey; to: AnchorKey }): string {
  return `${BLOCK_LABELS[w.from] ?? w.from} → ${BLOCK_LABELS[w.to] ?? w.to}`;
}

function minsLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} мин`;
  const hWord = h === 1 ? 'час' : h >= 2 && h <= 4 ? 'часа' : 'часов';
  return m > 0 ? `${h} ${hWord} ${m} мин` : `${h} ${hWord}`;
}