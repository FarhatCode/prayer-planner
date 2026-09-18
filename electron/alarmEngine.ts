import type { AlarmPayload, DayPlan, PrayerFetchResult, RegisterResult, Settings, Task, UpdateState } from '../shared/types';
import { parseHHMM, toHHMM } from '../src/lib/fmt';

export class AlarmEngine {
  private timer: ReturnType<typeof setInterval> | null = null;
  private fired = new Set<string>();

  constructor(
    private opts: {
      getSettings: () => Settings;
      getPlan: (date: string) => DayPlan | null;
      openAlarm: (p: AlarmPayload) => void;
    }
  ) {}

  start(): void {
    this.tick();
    this.timer = setInterval(() => this.tick(), 30000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  reset(): void {
    this.fired.clear();
  }

  private tick(): void {
    try {
      const settings = this.opts.getSettings();
      if (settings.useTaskScheduler) return; // alarm source is Windows Task Scheduler
      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const plan = this.opts.getPlan(date);
      if (!plan) return;
      const now = parseHHMM(toHHMM(d.getHours() * 60 + d.getMinutes()));
      for (const e of plan.entries) {
        const m = parseHHMM(e.time);
        if (m !== now) continue;
        const key = `${date}:${e.time}`;
        if (this.fired.has(key)) continue;
        this.fired.add(key);
        this.opts.openAlarm({ entry: e, test: false });
      }
    } catch {
      /* never crash the app from the engine */
    }
  }
}