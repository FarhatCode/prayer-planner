import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { CityMap, DayPlan, PrayerCache, Qaylulah, Settings, Task } from '../shared/types';
import { DEFAULT_SETTINGS, DEFAULT_TASKS } from '../shared/types';

const DATA_VERSION = 1;

function dir(): string {
  return app.getPath('userData');
}

function filePath(name: string): string {
  return path.join(dir(), name);
}

function readJson<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath(name), 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(name: string, obj: unknown): void {
  const full = filePath(name);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const tmp = full + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, full);
}

function normQaylulah(q: Partial<Qaylulah> | undefined, def: Qaylulah): Qaylulah {
  const minutes = Math.round(Number(q?.minutes ?? def.minutes));
  return {
    enabled: typeof q?.enabled === 'boolean' ? q.enabled : def.enabled,
    minutes: Math.max(40, Math.min(60, Number.isFinite(minutes) ? minutes : def.minutes)),
    start: typeof q?.start === 'string' ? q.start : def.start
  };
}

export const storage = {
  settings(): Settings {
    const raw = readJson<Partial<Settings>>('settings.json', {});
    const defaults = DEFAULT_SETTINGS;
    const windows = raw.windows && raw.windows.length ? raw.windows : defaults.windows;
    return {
      ...defaults,
      ...raw,
      windows,
      cityId: Number(raw.cityId ?? defaults.cityId),
      slotMin: Number(raw.slotMin ?? defaults.slotMin),
      breakMin: Number(raw.breakMin ?? defaults.breakMin),
      volume: Number(raw.volume ?? defaults.volume),
      closeToTray: typeof raw.closeToTray === 'boolean' ? raw.closeToTray : defaults.closeToTray,
      useTaskScheduler: typeof raw.useTaskScheduler === 'boolean' ? raw.useTaskScheduler : defaults.useTaskScheduler,
      autoLaunch: typeof raw.autoLaunch === 'boolean' ? raw.autoLaunch : defaults.autoLaunch,
      qaylulah: normQaylulah(raw.qaylulah, defaults.qaylulah)
    };
  },
  setSettings(patch: Partial<Settings>): Settings {
    const base = storage.settings();
    const next: Settings = {
      ...base,
      ...patch,
      windows: patch.windows ?? base.windows,
      cityId: Number(patch.cityId ?? base.cityId),
      slotMin: Number(patch.slotMin ?? base.slotMin),
      breakMin: Number(patch.breakMin ?? base.breakMin),
      volume: Number(patch.volume ?? base.volume),
      closeToTray: typeof patch.closeToTray === 'boolean' ? patch.closeToTray : base.closeToTray,
      useTaskScheduler: typeof patch.useTaskScheduler === 'boolean' ? patch.useTaskScheduler : base.useTaskScheduler,
      autoLaunch: typeof patch.autoLaunch === 'boolean' ? patch.autoLaunch : base.autoLaunch,
      qaylulah: normQaylulah(patch.qaylulah, base.qaylulah)
    };
    writeJson('settings.json', next);
    return next;
  },

  tasks(): Task[] {
    const raw = readJson<Task[] | Record<string, unknown>>('tasks.json', DEFAULT_TASKS as unknown as Record<string, unknown>);
    if (Array.isArray(raw)) return raw as Task[];
    if (raw && typeof raw === 'object') {
      // migrate legacy object { name: hours } to array
      return Object.entries(raw as Record<string, unknown>).map(([name, hours], i) => ({
        id: String(i + 1),
        name,
        hours: typeof hours === 'number' ? hours : 1,
        desc: '',
        color: '#4c86f5',
        canMove: true
      })) as Task[];
    }
    return DEFAULT_TASKS;
  },
  setTasks(tasks: Task[]): void {
    writeJson('tasks.json', tasks);
  },

  prayerCache(): PrayerCache | null {
    return readJson<PrayerCache | null>('prayer-cache.json', null);
  },
  setPrayerCache(c: PrayerCache | null): void {
    if (c) writeJson('prayer-cache.json', c);
    else {
      const p = filePath('prayer-cache.json');
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  },

  cities(): CityMap {
    return readJson<CityMap>('cities.json', {});
  },
  setCities(c: CityMap): void {
    writeJson('cities.json', c);
  },

  todayPlan(): DayPlan | null {
    const s = this.settings();
    const date = todayStr();
    return this.plan(date);
  },
  plan(date: string): DayPlan | null {
    return readJson<DayPlan | null>(path.join('plans', `${date}.json`), null);
  },
  setPlan(date: string, plan: DayPlan | null): void {
    if (plan) writeJson(path.join('plans', `${date}.json`), plan);
    else {
      const p = filePath(path.join('plans', `${date}.json`));
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  },

  dataDir(): string {
    return dir();
  }
};

export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}